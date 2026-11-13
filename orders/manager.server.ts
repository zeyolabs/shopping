import type Stripe from 'stripe';

import { logger } from '@zeyolabs/kit/server/logger';

import { ShopClients } from '../clients/shop.server';
import { shopping } from '../config';
import { ShippingService } from '../shipping/service.server';
import { Orders } from './library';
import { type NewOrderItem, OrderService } from './service.server';

/** Orders at the edge: turning a paid Stripe session into an order, and invoice links. */
export const OrderManager = {
	/**
	 * Turns a paid Checkout Session into an order. Idempotent and resumable: Stripe retries webhooks
	 * and the success page may race them. The unique `stripe_session_id` decides who creates the
	 * order, and the unique (order, sku) index plus the atomic item/stock batch decide who writes the
	 * items; only that delivery sends the emails and pushes to Royal Mail.
	 */
	async fulfil(sessionId: string): Promise<void> {
		const config = shopping();
		const db = config.db();
		const service = new OrderService(db);
		let order = await service.bySession(sessionId);
		if (order && (await service.hasItems(order.id))) return;

		const session = await ShopClients.stripe().checkout.sessions.retrieve(sessionId, {
			expand: ['line_items.data.price.product'],
		});
		if (session.payment_status !== 'paid') return;

		const shipping = session.collected_information?.shipping_details;
		const email = session.customer_details?.email;
		if (!shipping?.address || !email) {
			throw new Error(`Checkout session ${sessionId} is paid but has no shipping address or email`);
		}

		order ??= await service.create(
			{
				discountPence: session.total_details?.amount_discount ?? 0,
				email,
				number: Orders.newNumber(config.orderNumberPrefix),
				paidAt: Date.now(),
				shippingPence: session.total_details?.amount_shipping ?? 0,
				shippingService: session.metadata?.shippingService ?? null,
				status: 'paid',
				stripeInvoiceId: typeof session.invoice === 'string' ? session.invoice : null,
				stripePaymentIntentId:
					typeof session.payment_intent === 'string' ? session.payment_intent : null,
				stripeSessionId: session.id,
				subtotalPence: session.amount_subtotal ?? 0,
				totalPence: session.amount_total ?? 0,
				weightGrams: Number(session.metadata?.weightGrams) || null,
			},
			{
				city: shipping.address.city ?? '',
				country: shipping.address.country ?? 'GB',
				line1: shipping.address.line1 ?? '',
				line2: shipping.address.line2,
				name: shipping.name ?? session.customer_details?.name ?? '',
				phone: session.customer_details?.phone,
				postcode: shipping.address.postal_code ?? '',
			}
		);

		const items: NewOrderItem[] = (session.line_items?.data ?? []).map((line) => {
			const product = line.price?.product as Stripe.Product;
			const productId = Number(product.metadata.productId);
			return {
				name: line.description ?? product.name,
				productId: Number.isInteger(productId) ? productId : null,
				quantity: line.quantity ?? 1,
				sku: product.metadata.sku ?? '',
				unitPricePence: line.price?.unit_amount ?? 0,
			};
		});
		if (!(await service.writeItems(order.id, items))) return;

		// The customer is already charged and the order recorded: neither follow-up may fail the webhook.
		const address = { ...shipping.address, name: shipping.name ?? '' };
		try {
			const details = {
				address,
				discountPence: order.discountPence,
				email,
				items,
				number: order.number,
				orderUrl: order.accessToken
					? Orders.url(config.siteUrl, order.number, order.accessToken)
					: undefined,
				phone: session.customer_details?.phone,
				shippingPence: order.shippingPence,
				subtotalPence: order.subtotalPence,
				totalPence: order.totalPence,
			};
			await config.mail.orderConfirmed(details);
			await config.mail.newOrderAlert(details);
		} catch (error) {
			logger.error(error, { op: 'orderConfirmationEmail', orderNumber: order.number });
		}

		if (!order.royalMailOrderId) {
			try {
				const shippingService = new ShippingService(db);
				const royalMailOrderId = await ShopClients.royalMail().createOrder({
					address,
					createdAt: order.createdAt,
					email,
					number: order.number,
					phone: session.customer_details?.phone,
					serviceCode: await shippingService.serviceCode(order.shippingService),
					shippingPence: order.shippingPence,
					subtotalPence: order.subtotalPence,
					totalPence: order.totalPence,
					weightGrams: order.weightGrams ?? 0,
				});
				await service.setRoyalMailOrderId(order.id, royalMailOrderId);
			} catch (error) {
				logger.error(error, { op: 'royalMailPush', orderNumber: order.number });
			}
		}
	},

	/**
	 * A fresh link to an order's Stripe invoice PDF, or undefined when it has none. Stripe's links
	 * expire, so the shop stores only the invoice id and asks Stripe each time.
	 */
	async invoiceUrl(stripeInvoiceId: null | string): Promise<string | undefined> {
		if (!stripeInvoiceId) return undefined;
		const invoice = await ShopClients.stripe().invoices.retrieve(stripeInvoiceId);
		return invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? undefined;
	},
};
