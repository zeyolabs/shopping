import { logger } from '@zeyolabs/kit/server/logger';
import { Crypto } from '@zeyolabs/kit/utils/crypto';
import { Error400, Error404 } from '@zeyolabs/kit/utils/errors';
import { and, asc, count, desc, eq, inArray, like, or } from 'drizzle-orm';

import type { OrderFilter } from '../admin/filters';
import type { OrderStep } from '../admin/orders.schema';

import { secret, shopping } from '../config';
import { addresses, orderItems, orders, type PackageFormat, products } from '../db/schema';
import { orderUrl } from '../order-links';
import {
	createClickAndDropOrder,
	deleteClickAndDropOrder,
	getClickAndDropLabel,
	getClickAndDropTracking,
} from '../royalmail';
import { quoteServiceCode } from './shipping';

const getDb = () => shopping().db();

/** Escapes LIKE wildcards so a search for "100%" matches literally. */
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

export async function listOrders(filter: OrderFilter, query: string) {
	const search = query.trim();
	const match = search ? likePattern(search) : undefined;
	return (
		getDb()
			.select({
				country: addresses.country,
				createdAt: orders.createdAt,
				email: orders.email,
				heldAt: orders.heldAt,
				labelCreatedAt: orders.labelCreatedAt,
				name: addresses.name,
				number: orders.number,
				packedAt: orders.packedAt,
				packingStartedAt: orders.packingStartedAt,
				shippedAt: orders.shippedAt,
				status: orders.status,
				totalPence: orders.totalPence,
			})
			.from(orders)
			.innerJoin(addresses, eq(orders.shippingAddressId, addresses.id))
			.where(
				and(
					filter === 'to-ship' ? eq(orders.status, 'paid') : undefined,
					filter === 'shipped' ? eq(orders.status, 'shipped') : undefined,
					match
						? or(like(orders.number, match), like(orders.email, match), like(addresses.name, match))
						: undefined
				)
			)
			// Oldest first when packing, newest first when browsing.
			.orderBy(filter === 'to-ship' ? asc(orders.createdAt) : desc(orders.createdAt))
			.limit(200)
	);
}

export async function countOrders(): Promise<Record<OrderFilter, number>> {
	const rows = await getDb()
		.select({ n: count(), status: orders.status })
		.from(orders)
		.groupBy(orders.status);
	const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.n]));
	return {
		all: rows.reduce((sum, r) => sum + r.n, 0),
		shipped: byStatus.shipped ?? 0,
		'to-ship': byStatus.paid ?? 0,
	};
}

/** The order with its address, items and the weight the items add up to. */
export async function findOrder(number: string) {
	const db = getDb();
	const order = await db.query.orders.findFirst({ where: eq(orders.number, number) });
	if (!order) return undefined;
	const [items, address] = await Promise.all([
		db.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id) }),
		db.query.addresses.findFirst({ where: eq(addresses.id, order.shippingAddressId) }),
	]);
	if (!address) return undefined;
	return {
		...order,
		address,
		customerUrl: order.accessToken ? orderUrl(order.number, order.accessToken) : null,
		estimatedWeightGrams: await estimateWeight(items),
		items,
	};
}

/** What the basket weighs by the products' current weights; the starting point for packing. */
async function estimateWeight(items: { productId: null | number; quantity: number }[]) {
	const ids = items.flatMap((item) => (item.productId === null ? [] : [item.productId]));
	if (ids.length === 0) return 0;
	const rows = await getDb()
		.select({ id: products.id, massGrams: products.massGrams })
		.from(products)
		.where(inArray(products.id, ids));
	const mass = new Map(rows.map((row) => [row.id, row.massGrams]));
	return items.reduce(
		(sum, item) =>
			sum + (item.productId === null ? 0 : (mass.get(item.productId) ?? 0) * item.quantity),
		0
	);
}

/**
 * Marks a paid order as dispatched, records the tracking number and emails the customer. The
 * database change comes first: a failed email never undoes a parcel that has really left, and the
 * result says whether the email went so the admin can resend it.
 */
export async function markShipped(number: string, trackingNumber: null | string) {
	const order = await findOrder(number);
	if (!order) throw Error404('Order not found.');
	const { address } = order;
	if (order.status !== 'paid' && order.status !== 'shipped') {
		throw Error400(`This order is ${order.status}, so it cannot be dispatched.`);
	}

	// No tracking number typed in: take the one Click & Drop assigned (tracked services only).
	let tracking = trackingNumber;
	if (!tracking && order.royalMailOrderId) {
		try {
			tracking =
				(await getClickAndDropTracking(secret('royalMailApiKey'), order.royalMailOrderId)) ?? null;
		} catch (error) {
			logger.error(error, { op: 'royalMailTracking', orderNumber: order.number });
		}
	}

	// Orders from before the order page existed have no link token: mint one so the email can link.
	const accessToken = order.accessToken ?? Crypto.getRandomSecret(16);
	const now = Date.now();
	await getDb()
		.update(orders)
		.set({
			accessToken,
			// Dispatching implies the earlier steps happened, so fill in any that were skipped.
			heldAt: null,
			packedAt: order.packedAt ?? now,
			packingStartedAt: order.packingStartedAt ?? now,
			shippedAt: order.shippedAt ?? now,
			status: 'shipped',
			trackingNumber: tracking,
		})
		.where(eq(orders.id, order.id));

	try {
		await shopping().mail.orderDispatched({
			address,
			email: order.email,
			number: order.number,
			token: accessToken,
			trackingNumber: tracking,
		});
		await getDb().update(orders).set({ dispatchEmailedAt: now }).where(eq(orders.id, order.id));
		return { emailed: true };
	} catch (error) {
		logger.error(error, { op: 'dispatchEmail', orderNumber: order.number });
		return { emailed: false };
	}
}

/** Orders only move through packing while they are paid and not yet shipped. */
async function packableOrder(number: string) {
	const order = await getDb().query.orders.findFirst({ where: eq(orders.number, number) });
	if (!order) throw Error404('Order not found.');
	if (order.status !== 'paid')
		throw Error400(`This order is ${order.status}, so it cannot be packed.`);
	return order;
}

export async function startPacking(number: string) {
	const order = await packableOrder(number);
	if (order.packingStartedAt && !order.heldAt) return;
	await getDb()
		.update(orders)
		.set({ heldAt: null, packingStartedAt: order.packingStartedAt ?? Date.now() })
		.where(eq(orders.id, order.id));
}

/** Packed implies packing started, and a held order that gets packed is no longer held. */
export async function markPacked(number: string) {
	const order = await packableOrder(number);
	const now = Date.now();
	await getDb()
		.update(orders)
		.set({ heldAt: null, packedAt: now, packingStartedAt: order.packingStartedAt ?? now })
		.where(eq(orders.id, order.id));
}

export async function setHold(number: string, held: boolean) {
	const order = await packableOrder(number);
	await getDb()
		.update(orders)
		.set({ heldAt: held ? Date.now() : null })
		.where(eq(orders.id, order.id));
}

const STEP_ACTIONS: Record<OrderStep, (number: string) => Promise<void>> = {
	hold: (number) => setHold(number, true),
	pack: markPacked,
	release: (number) => setHold(number, false),
	start: startPacking,
};

/** Moves a paid order to its next packing state. */
export const applyStep = (number: string, step: OrderStep) => STEP_ACTIONS[step](number);

export type Parcel = {
	format: PackageFormat;
	heightMm: null | number;
	lengthMm: null | number;
	weightGrams: number;
	widthMm: null | number;
};

export async function saveParcel(number: string, parcel: Parcel) {
	const order = await packableOrder(number);
	await getDb()
		.update(orders)
		.set({
			packageFormat: parcel.format,
			packageHeightMm: parcel.heightMm,
			packageLengthMm: parcel.lengthMm,
			packageWidthMm: parcel.widthMm,
			weightGrams: parcel.weightGrams,
		})
		.where(eq(orders.id, order.id));
}

/**
 * Makes sure Click & Drop holds this order with the parcel as packed, so its label is right.
 * Click & Drop cannot edit an order, so until a label exists the old one is removed and re-created.
 * Creating the label counts as packing, so it also fills in any earlier packing step.
 */
export async function createLabel(number: string) {
	const order = await findOrder(number);
	if (!order) throw Error404('Order not found.');
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

	const db = getDb();
	if (order.royalMailOrderId)
		await deleteClickAndDropOrder(secret('royalMailApiKey'), order.royalMailOrderId);
	const royalMailOrderId = await createClickAndDropOrder(secret('royalMailApiKey'), {
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
		serviceCode: await quoteServiceCode(db, order.shippingService),
		shippingPence: order.shippingPence,
		subtotalPence: order.subtotalPence,
		totalPence: order.totalPence,
		weightGrams,
	});
	// Keep the new id before fetching the label, so a failed fetch can be retried without a duplicate.
	await db.update(orders).set({ royalMailOrderId }).where(eq(orders.id, order.id));
	await getClickAndDropLabel(secret('royalMailApiKey'), royalMailOrderId);

	const now = Date.now();
	await db
		.update(orders)
		.set({
			heldAt: null,
			labelCreatedAt: now,
			packedAt: order.packedAt ?? now,
			packingStartedAt: order.packingStartedAt ?? now,
			weightGrams,
		})
		.where(eq(orders.id, order.id));
}

/** The label PDF for an order that already has one. */
export async function fetchLabel(number: string) {
	const order = await getDb().query.orders.findFirst({ where: eq(orders.number, number) });
	if (!order?.royalMailOrderId || !order.labelCreatedAt)
		throw Error404('No label for this order yet.');
	return getClickAndDropLabel(secret('royalMailApiKey'), order.royalMailOrderId);
}
