import { Crypto } from '@zeyolabs/kit/utils/crypto';
import { eq, inArray, sql } from 'drizzle-orm';

import type { ShopDb } from '../db/index';

import {
	addresses,
	orderBundleItems,
	orderBundles,
	orderItems,
	orders,
	products,
} from '../db/schema';
import { StockService } from '../stock/service.server';
import { Batches } from '../utils/batches';
import { type BundleLine, Orders, type PlainLine } from './library';

/** A row binds at most 6 values and D1 allows 100 per statement, so a long order is written in slices. */
const ROWS_PER_INSERT = 10;

/** What a paid order's lines are written as: see `Orders.tidy`, which makes them one row per product and bundle. */
export type NewOrderLines = { bundles: BundleLine[]; items: PlainLine[] };
type NewAddress = Omit<typeof addresses.$inferInsert, 'createdAt' | 'id'>;
type NewOrder = Omit<
	typeof orders.$inferInsert,
	'accessToken' | 'createdAt' | 'id' | 'shippingAddressId'
>;

/** Orders: data access only. Payment, emails and Royal Mail are the order manager's. */
export class OrderService {
	constructor(private readonly db: ShopDb) {}

	async bySession(sessionId: string) {
		return this.db.query.orders.findFirst({ where: eq(orders.stripeSessionId, sessionId) });
	}

	/**
	 * Creates a paid order with its address. The unique `stripe_session_id` decides between racing
	 * webhook deliveries: the loser drops its orphaned address and gets the winner's order.
	 */
	async create(order: NewOrder, address: NewAddress, now = Date.now()) {
		const [addressRow] = await this.db
			.insert(addresses)
			.values({ ...address, createdAt: now })
			.returning({ id: addresses.id });
		try {
			const [row] = await this.db
				.insert(orders)
				.values({
					...order,
					accessToken: Crypto.getRandomSecret(16),
					createdAt: now,
					shippingAddressId: addressRow.id,
				})
				.returning();
			return row;
		} catch (error) {
			await this.db.delete(addresses).where(eq(addresses.id, addressRow.id));
			const existing = order.stripeSessionId
				? await this.bySession(order.stripeSessionId)
				: undefined;
			if (!existing) throw error;
			return existing;
		}
	}

	/** Order, items and address for the customer's order page. Undefined unless the token matches. */
	async forCustomer(number: string, token: string) {
		const order = await this.db.query.orders.findFirst({ where: eq(orders.number, number) });
		if (!order?.accessToken || !Crypto.timingSafeEquals(order.accessToken, token)) return undefined;
		const [items, address] = await Promise.all([
			this.linesOf(order.id),
			this.db.query.addresses.findFirst({ where: eq(addresses.id, order.shippingAddressId) }),
		]);
		return { address, items, order };
	}

	/** Whether the order has any line: a bundle-only order has no plain ones. */
	async hasItems(orderId: number): Promise<boolean> {
		const [item, bundle] = await Promise.all([
			this.db.query.orderItems.findFirst({ where: eq(orderItems.orderId, orderId) }),
			this.db.query.orderBundles.findFirst({ where: eq(orderBundles.orderId, orderId) }),
		]);
		return item !== undefined || bundle !== undefined;
	}

	/**
	 * What the order bought: its plain lines, then its bundles, each with the parts that make it up
	 * (empty for a plain line). Each group is by name (ignoring case), then id.
	 */
	async linesOf(orderId: number) {
		const [items, bundles] = await Promise.all([
			this.db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
			this.db.select().from(orderBundles).where(eq(orderBundles.orderId, orderId)),
		]);
		const parts = await Batches.rows(
			bundles.map((bundle) => bundle.id),
			(slice) =>
				this.db
					.select()
					.from(orderBundleItems)
					.where(inArray(orderBundleItems.orderBundleId, slice))
		);
		const byName = <T extends { id: number; name: string }>(a: T, b: T) =>
			Orders.byName(a, b) || a.id - b.id;
		return [
			...items.sort(byName).map((item) => ({ ...item, kind: 'item' as const, parts: [] })),
			...bundles.sort(byName).map((bundle) => ({
				...bundle,
				kind: 'bundle' as const,
				parts: parts.filter((part) => part.orderBundleId === bundle.id).sort(byName),
				productId: null,
			})),
		];
	}

	/** Names by id, for a bundle's parts on a new order. */
	async productNames(ids: number[]): Promise<Map<number, string>> {
		if (ids.length === 0) return new Map();
		const rows = await Batches.rows(ids, (slice) =>
			this.db
				.select({
					id: products.id,
					label: products.variationLabel,
					name: products.name,
				})
				.from(products)
				.where(inArray(products.id, slice))
		);
		return new Map(rows.map((r) => [r.id, r.label ? `${r.name} (${r.label})` : r.name]));
	}

	async setRoyalMailOrderId(orderId: number, royalMailOrderId: string) {
		await this.db.update(orders).set({ royalMailOrderId }).where(eq(orders.id, orderId));
	}

	/**
	 * Writes the items and takes their stock in one atomic batch. False when another delivery of the
	 * same session already wrote them (the batch failed and the items exist), so nothing is doubled.
	 */
	async writeItems(orderId: number, lines: NewOrderLines): Promise<boolean> {
		const { bundles, items } = Orders.tidy(lines);
		// Read before the batch: the stock statements depend on pack sizes and components.
		const stock = new StockService(this.db);
		const stockStatements = await stock.paidStatements([
			...items.flatMap((item) =>
				item.productId === null ? [] : [{ productId: item.productId, quantity: item.quantity }]
			),
			...bundles.flatMap((bundle) =>
				bundle.parts.flatMap((part) =>
					part.productId === null
						? []
						: [
								{
									productId: part.productId,
									quantity: part.quantity,
									singleUnits: part.singleUnits,
								},
							]
				)
			),
		]);
		const itemRows = items.map((item) => ({ ...item, orderId }));
		const bundleRows = bundles.map(({ parts: _parts, ...bundle }) => ({ ...bundle, orderId }));
		// A part points at its bundle row by (order, bundle): the bundles are inserted earlier in the same batch.
		const partRows = bundles.flatMap((bundle) =>
			bundle.parts.map((part) => ({
				...part,
				orderBundleId: sql<number>`(select ${orderBundles.id} from ${orderBundles} where ${orderBundles.orderId} = ${orderId} and ${orderBundles.bundleId} is ${bundle.bundleId})`,
			}))
		);
		try {
			const [first, ...rest] = [
				...Batches.chunks(itemRows, ROWS_PER_INSERT).map((slice) =>
					this.db.insert(orderItems).values(slice)
				),
				...Batches.chunks(bundleRows, ROWS_PER_INSERT).map((slice) =>
					this.db.insert(orderBundles).values(slice)
				),
				...Batches.chunks(partRows, ROWS_PER_INSERT).map((slice) =>
					this.db.insert(orderBundleItems).values(slice)
				),
				...stockStatements,
			];
			await this.db.batch([first, ...rest]);
			return true;
		} catch (error) {
			if (await this.hasItems(orderId)) return false;
			throw error;
		}
	}
}
