import { Error400, Error404 } from '@zeyolabs/kit/utils/errors';
import { and, asc, count, desc, eq, inArray, or, sql } from 'drizzle-orm';

import type { ShopDb } from '../db/index';
import type { OrderFilter } from './filters';
import type { OrderDetails } from './schema';

import { Search } from '../catalogue/library';
import { addresses, orderItems, orders, type PackageFormat, products } from '../db/schema';
import { Batches } from '../utils/batches';

export type Parcel = {
	format: PackageFormat;
	heightMm: null | number;
	lengthMm: null | number;
	weightGrams: number;
	widthMm: null | number;
};

type OrderRow = typeof orders.$inferSelect;

/** Fulfilment data access: the order list, one order in full, and the packing state changes. */
export class FulfilmentService {
	constructor(private readonly db: ShopDb) {}

	/** Order counts per list filter, for the filter tabs. */
	async counts(): Promise<Record<OrderFilter, number>> {
		const rows = await this.db
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
	async find(number: string) {
		const order = await this.db.query.orders.findFirst({ where: eq(orders.number, number) });
		if (!order) return undefined;
		const [items, address] = await Promise.all([
			this.db.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id) }),
			this.db.query.addresses.findFirst({ where: eq(addresses.id, order.shippingAddressId) }),
		]);
		if (!address) return undefined;
		return { ...order, address, estimatedWeightGrams: await this.estimateWeight(items), items };
	}

	/** Orders for the admin list: oldest first when packing, newest first when browsing. */
	async list(filter: OrderFilter, query: string) {
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
					filter === 'to-ship' ? eq(orders.status, 'paid') : undefined,
					filter === 'shipped' ? eq(orders.status, 'shipped') : undefined,
					match
						? or(
								sql`${orders.number} like ${match} escape '\\'`,
								sql`${orders.email} like ${match} escape '\\'`,
								sql`${addresses.name} like ${match} escape '\\'`
							)
						: undefined
				)
			)
			.orderBy(filter === 'to-ship' ? asc(orders.createdAt) : desc(orders.createdAt))
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
			packageHeightMm: parcel.heightMm,
			packageLengthMm: parcel.lengthMm,
			packageWidthMm: parcel.widthMm,
			weightGrams: parcel.weightGrams,
		});
	}

	async setHold(number: string, held: boolean, now = Date.now()) {
		const order = await this.packable(number);
		await this.update(order.id, { heldAt: held ? now : null });
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
