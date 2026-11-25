import { Error400, Error404 } from '@zeyolabs/kit/utils/errors';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';

import type { ShopDb } from '../db/index';
import type { OrderFilter } from './filters';
import type { OrderDetails } from './schema';

import { CoverService } from '../catalogue/covers.server';
import { Search } from '../catalogue/library';
import { addresses, orderItems, orders, type PackageFormat, products } from '../db/schema';
import { Batches } from '../utils/batches';

export type Parcel = { format: PackageFormat; weightGrams: number };

type OrderRow = typeof orders.$inferSelect;

/** Ready to dispatch: paid, not held, and labelled (or, without labels, packed). */
function readyCondition(requireLabel: boolean) {
	return and(
		eq(orders.status, 'paid'),
		isNull(orders.heldAt),
		requireLabel ? isNotNull(orders.labelCreatedAt) : isNotNull(orders.packedAt)
	);
}

/** The SQL condition behind each list filter: paid orders are split by hold and label. */
function filterCondition(filter: OrderFilter, requireLabel: boolean) {
	switch (filter) {
		case 'all':
			return undefined;
		case 'on-hold':
			return and(eq(orders.status, 'paid'), isNotNull(orders.heldAt));
		case 'ready':
			return readyCondition(requireLabel);
		case 'shipped':
			return eq(orders.status, 'shipped');
		case 'to-ship':
			return eq(orders.status, 'paid');
		case 'unpaid':
			return eq(orders.status, 'pending');
	}
}

/** Fulfilment data access: the order list, one order in full, and the packing state changes. */
export class FulfilmentService {
	constructor(private readonly db: ShopDb) {}

	/** Order counts per list filter, for the filter tabs. */
	async counts(requireLabel = true): Promise<Record<OrderFilter, number>> {
		const [row] = await this.db
			.select({
				all: count(),
				onHold: sql<number>`coalesce(sum(${orders.status} = 'paid' and ${orders.heldAt} is not null), 0)`,
				ready: sql<number>`coalesce(sum(${orders.status} = 'paid' and ${orders.heldAt} is null and ${requireLabel ? orders.labelCreatedAt : orders.packedAt} is not null), 0)`,
				shipped: sql<number>`coalesce(sum(${orders.status} = 'shipped'), 0)`,
				toShip: sql<number>`coalesce(sum(${orders.status} = 'paid'), 0)`,
				unpaid: sql<number>`coalesce(sum(${orders.status} = 'pending'), 0)`,
			})
			.from(orders);
		return {
			all: row.all,
			'on-hold': Number(row.onHold),
			ready: Number(row.ready),
			shipped: Number(row.shipped),
			'to-ship': Number(row.toShip),
			unpaid: Number(row.unpaid),
		};
	}

	/** The order with its address, items and the weight the items add up to. */
	async find(number: string) {
		const order = await this.db.query.orders.findFirst({ where: eq(orders.number, number) });
		if (!order) return undefined;
		const [items, address] = await Promise.all([
			this.db.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id) }),
			this.db.query.addresses.findFirst({ where: eq(addresses.id, order.shippingAddressId) }),
		]);
		if (!address) return undefined;
		const productIds = items.flatMap((item) => (item.productId === null ? [] : [item.productId]));
		const coverService = new CoverService(this.db);
		const [covers, estimatedWeightGrams] = await Promise.all([
			coverService.covers(productIds),
			this.estimateWeight(items),
		]);
		return {
			...order,
			address,
			estimatedWeightGrams,
			items: items.map((item) => ({
				...item,
				cover: item.productId === null ? null : (covers.get(item.productId) ?? null),
			})),
		};
	}

	/** Orders for the admin list: oldest first when packing, newest first when browsing. */
	async list(filter: OrderFilter, query: string, requireLabel = true) {
		const search = query.trim();
		const match = search ? Search.pattern(search) : undefined;
		return this.db
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
					filterCondition(filter, requireLabel),
					match
						? or(
								sql`${orders.number} like ${match} escape '\\'`,
								sql`${orders.email} like ${match} escape '\\'`,
								sql`${addresses.name} like ${match} escape '\\'`
							)
						: undefined
				)
			)
			.orderBy(
				filter === 'to-ship' || filter === 'ready' || filter === 'on-hold'
					? asc(orders.createdAt)
					: desc(orders.createdAt)
			)
			.limit(200);
	}

	/** Packed implies packing started, and a held order that gets packed is no longer held. */
	async markPacked(number: string, now = Date.now()) {
		const order = await this.packable(number);
		await this.update(order.id, {
			heldAt: null,
			packedAt: now,
			packingStartedAt: order.packingStartedAt ?? now,
		});
	}

	/** A paid order that can move through packing; 404 or 400 otherwise. */
	async packable(number: string): Promise<OrderRow> {
		const order = await this.db.query.orders.findFirst({ where: eq(orders.number, number) });
		if (!order) throw Error404('Order not found.');
		if (order.status !== 'paid')
			throw Error400(`This order is ${order.status}, so it cannot be packed.`);
		return order;
	}

	/** Orders ready to dispatch (see `readyCondition`), counted per postage service. */
	async readyByService(requireLabel = true): Promise<Record<string, number>> {
		const rows = await this.db
			.select({ n: count(), service: orders.shippingService })
			.from(orders)
			.where(filterCondition('ready', requireLabel))
			.groupBy(orders.shippingService);
		return Object.fromEntries(rows.map((r) => [r.service ?? 'No service', r.n]));
	}

	/**
	 * Corrects the customer's contact, the address and the postage service of a paid or shipped
	 * order. Returns whether anything Click & Drop holds (address, email, phone, service) changed.
	 */
	async saveDetails(
		number: string,
		details: Omit<OrderDetails, 'number' | 'trackingNumber'> & { trackingNumber?: null | string }
	) {
		const order = await this.db.query.orders.findFirst({ where: eq(orders.number, number) });
		if (!order) throw Error404('Order not found.');
		if (order.status !== 'paid' && order.status !== 'shipped')
			throw Error400(`This order is ${order.status}, so its details cannot be edited.`);
		const address = await this.db.query.addresses.findFirst({
			where: eq(addresses.id, order.shippingAddressId),
		});
		if (!address) throw Error404('Order not found.');

		const next = {
			city: details.city,
			country: details.country,
			line1: details.line1,
			line2: details.line2 || null,
			name: details.name,
			phone: details.phone || null,
			postcode: details.postcode,
		};
		// A blank service keeps the order's current one: a paid order should not lose its postage.
		const service = details.shippingService || order.shippingService;
		const email = details.email.toLowerCase();
		const labelAffected =
			email !== order.email.toLowerCase() ||
			service !== order.shippingService ||
			(Object.keys(next) as (keyof typeof next)[]).some((key) => next[key] !== address[key]);
		// Click & Drop cannot edit an order: a label made before the change is stale, so printing
		// again replaces it. Cleared in the same batch as the address, so they cannot disagree.
		const labelStale = labelAffected && order.status === 'paid' && order.labelCreatedAt !== null;

		await this.db.batch([
			this.db.update(addresses).set(next).where(eq(addresses.id, address.id)),
			this.db
				.update(orders)
				.set({
					email: details.email,
					shippingService: service,
					...(labelStale ? { labelCreatedAt: null } : {}),
					...(details.trackingNumber === undefined
						? {}
						: { trackingNumber: details.trackingNumber || null }),
				})
				.where(eq(orders.id, order.id)),
		]);
		return { labelStale };
	}

	async saveParcel(number: string, parcel: Parcel) {
		const order = await this.packable(number);
		await this.update(order.id, {
			packageFormat: parcel.format,
			weightGrams: parcel.weightGrams,
		});
	}

	async setHold(number: string, held: boolean, now = Date.now()) {
		const order = await this.packable(number);
		await this.update(order.id, { heldAt: held ? now : null });
	}

	/**
	 * Sets the order's refunded total to what Stripe reports (never lower than recorded), so
	 * recording the same refund twice, or two at once, gives the same result. Reaching the order
	 * total makes it `refunded`.
	 */
	async setRefunded(orderId: number, refundedPence: number) {
		await this.db
			.update(orders)
			.set({
				refundedPence: sql`max(${orders.refundedPence}, ${refundedPence})`,
				status: sql`case when ${refundedPence} >= ${orders.totalPence} then 'refunded' else ${orders.status} end`,
			})
			.where(eq(orders.id, orderId));
	}

	async startPacking(number: string, now = Date.now()) {
		const order = await this.packable(number);
		if (order.packingStartedAt && !order.heldAt) return;
		await this.update(order.id, {
			heldAt: null,
			packingStartedAt: order.packingStartedAt ?? now,
		});
	}

	/** Writes order fields by id (the manager decides what changes). */
	async update(orderId: number, values: Partial<Omit<OrderRow, 'id'>>) {
		await this.db.update(orders).set(values).where(eq(orders.id, orderId));
	}

	/** What the items weigh by the products' current weights; the starting point for packing. */
	private async estimateWeight(items: { productId: null | number; quantity: number }[]) {
		const ids = items.flatMap((item) => (item.productId === null ? [] : [item.productId]));
		if (ids.length === 0) return 0;
		const rows = await Batches.rows(ids, (slice) =>
			this.db
				.select({ id: products.id, massGrams: products.massGrams })
				.from(products)
				.where(inArray(products.id, slice))
		);
		const mass = new Map(rows.map((row) => [row.id, row.massGrams]));
		return items.reduce(
			(sum, item) =>
				sum + (item.productId === null ? 0 : (mass.get(item.productId) ?? 0) * item.quantity),
			0
		);
	}
}
