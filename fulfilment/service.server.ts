import { Error400, Error404 } from '@zeyolabs/kit/utils/errors';
import { and, asc, count, desc, eq, inArray, like, or } from 'drizzle-orm';

import type { ShopDb } from '../db/index';
import type { OrderFilter } from './filters';

import { Search } from '../catalogue/library';
import { addresses, orderItems, orders, type PackageFormat, products } from '../db/schema';

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
						? or(like(orders.number, match), like(orders.email, match), like(addresses.name, match))
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
		const rows = await this.db
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
}
