import { logger } from '@zeyolabs/kit/server/logger';
import { Crypto } from '@zeyolabs/kit/utils/crypto';
import { Error400, Error404 } from '@zeyolabs/kit/utils/errors';

import type { OrderStep } from './schema';

import { ShopClients } from '../clients/shop.server';
import { shopping } from '../config';
import { Orders } from '../orders/library';
import { OrderManager } from '../orders/manager.server';
import { ShippingService } from '../shipping/service.server';
import { Money } from '../utils/money';
import { FulfilmentService, type Parcel } from './service.server';

const service = () => new FulfilmentService(shopping().db());

async function findOrThrow(number: string) {
	const fulfilment = service();
	const order = await fulfilment.find(number);
	if (!order) throw Error404('Order not found.');
	return order;
}

/** Fulfilment at the edge: packing steps, Royal Mail labels and the dispatch email. */
export const FulfilmentManager = {
	/** Moves a paid order to its next packing state. */
	async applyStep(number: string, step: OrderStep) {
		const fulfilment = service();
		if (step === 'start') return fulfilment.startPacking(number);
		if (step === 'pack') return fulfilment.markPacked(number);
		return fulfilment.setHold(number, step === 'hold');
	},

	counts() {
		const fulfilment = service();
		return fulfilment.counts();
	},

	/**
	 * Makes sure Click & Drop holds this order with the parcel as packed, so its label is right.
	 * Click & Drop cannot edit an order, so until a label exists the old one is removed and
	 * re-created. Creating the label counts as packing, so it fills in any earlier packing step.
	 */
	async createLabel(number: string) {
		const order = await findOrThrow(number);
		const { address, estimatedWeightGrams } = order;
		if (order.status !== 'paid') {
			throw Error400(`This order is ${order.status}, so it cannot have a label.`);
		}
		if (order.labelCreatedAt && order.royalMailOrderId) return;

		const weightGrams = order.weightGrams ?? estimatedWeightGrams;
		if (weightGrams < 1) throw Error400('Set the parcel weight before printing the label.');
		const { packageHeightMm, packageLengthMm, packageWidthMm } = order;
		const dimensions =
			packageHeightMm && packageLengthMm && packageWidthMm
				? { heightMm: packageHeightMm, lengthMm: packageLengthMm, widthMm: packageWidthMm }
				: null;

		const db = shopping().db();
		const fulfilment = new FulfilmentService(db);
		const shipping = new ShippingService(db);
		const client = ShopClients.royalMail();
		if (order.royalMailOrderId) await client.deleteOrder(order.royalMailOrderId);
		const royalMailOrderId = await client.createOrder({
			address: {
				city: address.city,
				country: address.country,
				line1: address.line1,
				line2: address.line2,
				name: address.name,
				postal_code: address.postcode,
				state: null,
			},
			createdAt: order.createdAt,
			dimensions,
			email: order.email,
			number: order.number,
			packageFormat: order.packageFormat,
			phone: address.phone,
			serviceCode: await shipping.serviceCode(order.shippingService),
			shippingPence: order.shippingPence,
			subtotalPence: order.subtotalPence,
			totalPence: order.totalPence,
			weightGrams,
		});
		// Keep the new id before fetching the label, so a failed fetch can be retried without a duplicate.
		await fulfilment.update(order.id, { royalMailOrderId });
		await client.label(royalMailOrderId);

		const now = Date.now();
		await fulfilment.update(order.id, {
			heldAt: null,
			labelCreatedAt: now,
			packedAt: order.packedAt ?? now,
			packingStartedAt: order.packingStartedAt ?? now,
			weightGrams,
		});
	},

	/**
	 * Refunds `pence` of a paid or shipped order through Stripe, then records it. The idempotency
	 * key names the order, what was already refunded and the amount, so a retry after a failed
	 * database write returns the same Stripe refund instead of refunding twice. Stock is not put
	 * back: the admin does that on the stock page. Refunds made in the Stripe dashboard are not
	 * seen here.
	 */
	async refund(number: string, pence: number) {
		const order = await findOrThrow(number);
		if (order.status !== 'paid' && order.status !== 'shipped') {
			throw Error400(`This order is ${order.status}, so it cannot be refunded.`);
		}
		if (!order.stripePaymentIntentId) throw Error400('This order has no Stripe payment to refund.');
		const left = order.totalPence - order.refundedPence;
		if (pence > left) throw Error400(`Only ${Money.format(left)} is left to refund on this order.`);

		await ShopClients.stripe().refunds.create(
			{
				amount: pence,
				metadata: { order: order.number },
				payment_intent: order.stripePaymentIntentId,
			},
			{ idempotencyKey: `refund-${order.number}-${order.refundedPence}-${pence}` }
		);
		await service().recordRefund(order.id, pence);
		return { fullyRefunded: pence === left };
	},

	/** The order in full, with the customer's order page link. */
	async find(number: string) {
		const order = await findOrThrow(number);
		return {
			...order,
			customerUrl: order.accessToken
				? Orders.url(shopping().siteUrl, order.number, order.accessToken)
				: null,
		};
	},

	/** The order's Stripe invoice PDF link, or undefined. */
	async invoiceUrl(number: string) {
		const fulfilment = service();
		const order = await fulfilment.find(number);
		return OrderManager.invoiceUrl(order?.stripeInvoiceId ?? null);
	},

	/** The label PDF for an order that already has one. */
	async label(number: string) {
		const order = await findOrThrow(number);
		if (!order.royalMailOrderId || !order.labelCreatedAt)
			throw Error404('No label for this order yet.');
		return ShopClients.royalMail().label(order.royalMailOrderId);
	},

	list(filter: Parameters<FulfilmentService['list']>[0], query: string) {
		const fulfilment = service();
		return fulfilment.list(filter, query);
	},

	/**
	 * Marks a paid order as dispatched, records the tracking number and emails the customer. The
	 * database change comes first: a failed email never undoes a parcel that has really left, and
	 * the result says whether the email went so the admin can resend it.
	 */
	async markShipped(number: string, trackingNumber: null | string) {
		const order = await findOrThrow(number);
		const { address } = order;
		if (order.status !== 'paid' && order.status !== 'shipped') {
			throw Error400(`This order is ${order.status}, so it cannot be dispatched.`);
		}

		// No tracking number typed in: take the one Click & Drop assigned (tracked services only).
		let tracking = trackingNumber;
		if (!tracking && order.royalMailOrderId) {
			try {
				tracking = (await ShopClients.royalMail().trackingNumber(order.royalMailOrderId)) ?? null;
			} catch (error) {
				logger.error(error, { op: 'royalMailTracking', orderNumber: order.number });
			}
		}

		// Orders from before the order page existed have no link token: mint one so the email can link.
		const accessToken = order.accessToken ?? Crypto.getRandomSecret(16);
		const now = Date.now();
		const fulfilment = service();
		await fulfilment.update(order.id, {
			accessToken,
			// Dispatching implies the earlier steps happened, so fill in any that were skipped.
			heldAt: null,
			packedAt: order.packedAt ?? now,
			packingStartedAt: order.packingStartedAt ?? now,
			shippedAt: order.shippedAt ?? now,
			status: 'shipped',
			trackingNumber: tracking,
		});

		try {
			await shopping().mail.orderDispatched({
				address,
				email: order.email,
				number: order.number,
				token: accessToken,
				trackingNumber: tracking,
			});
			await fulfilment.update(order.id, { dispatchEmailedAt: now });
			return { emailed: true };
		} catch (error) {
			logger.error(error, { op: 'dispatchEmail', orderNumber: order.number });
			return { emailed: false };
		}
	},

	async saveParcel(number: string, parcel: Parcel) {
		const fulfilment = service();
		await fulfilment.saveParcel(number, parcel);
	},
};
