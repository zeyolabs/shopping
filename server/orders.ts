import type Stripe from 'stripe';

import { logger } from '@zeyolabs/kit/server/logger';
import { Crypto } from '@zeyolabs/kit/utils/crypto';
import { eq } from 'drizzle-orm';

import type { ShopDb } from '../db';

import { secret, shopping } from '../config';
import { addresses, orderItems, orders } from '../db/schema';
import { orderUrl } from '../order-links';
import { createClickAndDropOrder } from '../royalmail';
import { quoteServiceCode } from './shipping';
import { StockService } from './stock-service';
import { getStripe } from './stripe';

// No 0/O/1/I: the number is read out over the phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newOrderNumber(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(6));
	return `${shopping().orderNumberPrefix}-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')}`;
}

/** Order, items and address for the customer's order page. Undefined unless the token matches. */
export async function findOrderForCustomer(db: ShopDb, number: string, token: string) {
	const order = await db.query.orders.findFirst({ where: eq(orders.number, number) });
	if (!order?.accessToken || !Crypto.timingSafeEquals(order.accessToken, token)) return undefined;
	const [items, address] = await Promise.all([
		db.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id) }),
		db.query.addresses.findFirst({ where: eq(addresses.id, order.shippingAddressId) }),
	]);
	return { address, items, order };
}

/**
 * A fresh link to the order's Stripe invoice PDF, or undefined when the order has none. Stripe's
 * links expire, so the shop stores only the invoice id and asks Stripe each time.
 */
export async function invoicePdfUrl(stripeInvoiceId: null | string): Promise<string | undefined> {
	if (!stripeInvoiceId) return undefined;
	const invoice = await (await getStripe()).invoices.retrieve(stripeInvoiceId);
	return invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? undefined;
}

export async function findOrderBySession(db: ShopDb, sessionId: string) {
	return db.query.orders.findFirst({ where: eq(orders.stripeSessionId, sessionId) });
}

async function hasItems(db: ShopDb, orderId: number): Promise<boolean> {
	const row = await db.query.orderItems.findFirst({ where: eq(orderItems.orderId, orderId) });
	return row !== undefined;
}

/**
 * Turns a paid Checkout Session into an order. Idempotent and resumable: Stripe retries webhooks
 * and the success page may race them. The unique `stripe_session_id` decides who creates the order,
 * and the unique (order, sku) index plus the atomic item/stock batch decide who writes the items.
 */
export async function fulfilCheckoutSession(db: ShopDb, sessionId: string): Promise<void> {
	let order = await findOrderBySession(db, sessionId);
	if (order && (await hasItems(db, order.id))) return;

	const stripe = await getStripe();
	const session = await stripe.checkout.sessions.retrieve(sessionId, {
		expand: ['line_items.data.price.product'],
	});
	if (session.payment_status !== 'paid') return;

	const shipping = session.collected_information?.shipping_details;
	const email = session.customer_details?.email;
	if (!shipping?.address || !email) {
		throw new Error(`Checkout session ${sessionId} is paid but has no shipping address or email`);
	}

	const now = Date.now();
	if (!order) {
		const [address] = await db
			.insert(addresses)
			.values({
				city: shipping.address.city ?? '',
				country: shipping.address.country ?? 'GB',
				createdAt: now,
				line1: shipping.address.line1 ?? '',
				line2: shipping.address.line2,
				name: shipping.name ?? session.customer_details?.name ?? '',
				phone: session.customer_details?.phone,
				postcode: shipping.address.postal_code ?? '',
			})
			.returning({ id: addresses.id });

		try {
			[order] = await db
				.insert(orders)
				.values({
					accessToken: Crypto.getRandomSecret(16),
					createdAt: now,
					discountPence: session.total_details?.amount_discount ?? 0,
					email,
					number: newOrderNumber(),
					paidAt: now,
					shippingAddressId: address.id,
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
				})
				.returning();
		} catch (error) {
			// Lost the race to another delivery of the same session: drop our orphaned address.
			await db.delete(addresses).where(eq(addresses.id, address.id));
			order = await findOrderBySession(db, sessionId);
			if (!order) throw error;
		}
	}
	const orderId = order.id;

	const items = (session.line_items?.data ?? []).map((line) => {
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

	// Read before the batch: the stock statements depend on pack sizes and components, and the batch
	// itself stays one atomic write of the items and the stock (a double delivery sees the items).
	const stockStatements = await new StockService(db).paidStatements(
		items.flatMap((item) =>
			item.productId === null ? [] : [{ productId: item.productId, quantity: item.quantity }]
		)
	);
	try {
		await db.batch([
			db.insert(orderItems).values(items.map((item) => ({ ...item, orderId }))),
			...stockStatements,
		]);
	} catch (error) {
		// The batch is atomic, so if the items exist another delivery already wrote them and the stock.
		if (await hasItems(db, orderId)) return;
		throw error;
	}

	// The customer is already charged and the order recorded: neither follow-up may fail the webhook.
	try {
		const { mail } = shopping();
		const details = {
			address: { ...shipping.address, name: shipping.name ?? '' },
			discountPence: order.discountPence,
			email,
			items,
			number: order.number,
			orderUrl: order.accessToken ? orderUrl(order.number, order.accessToken) : undefined,
			phone: session.customer_details?.phone,
			shippingPence: order.shippingPence,
			subtotalPence: order.subtotalPence,
			totalPence: order.totalPence,
		};
		await mail.orderConfirmed(details);
		await mail.newOrderAlert(details);
	} catch (error) {
		logger.error(error, { op: 'orderConfirmationEmail', orderNumber: order.number });
	}

	if (!order.royalMailOrderId) {
		try {
			const royalMailOrderId = await createClickAndDropOrder(secret('royalMailApiKey'), {
				address: { ...shipping.address, name: shipping.name ?? '' },
				createdAt: order.createdAt,
				email,
				number: order.number,
				phone: session.customer_details?.phone,
				serviceCode: await quoteServiceCode(db, order.shippingService),
				shippingPence: order.shippingPence,
				subtotalPence: order.subtotalPence,
				totalPence: order.totalPence,
				weightGrams: order.weightGrams ?? 0,
			});
			await db.update(orders).set({ royalMailOrderId }).where(eq(orders.id, order.id));
		} catch (error) {
			logger.error(error, { op: 'royalMailPush', orderNumber: order.number });
		}
	}
}
