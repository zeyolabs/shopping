import { Crypto } from '@zeyolabs/kit/utils/crypto';
import { eq, inArray } from 'drizzle-orm';

import type { ShopDb } from '../db/index';

import { addresses, orderItems, orders, products } from '../db/schema';
import { StockService } from '../stock/service.server';
import { Batches } from '../utils/batches';

/** An item row binds 7 values and D1 allows 100 per statement, so a long order is written in slices. */
const ITEMS_PER_INSERT = 10;

export type NewOrderItem = Omit<typeof orderItems.$inferInsert, 'id' | 'orderId'>;
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
			this.db.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id) }),
			this.db.query.addresses.findFirst({ where: eq(addresses.id, order.shippingAddressId) }),
		]);
		return { address, items, order };
	}

	async hasItems(orderId: number): Promise<boolean> {
		const row = await this.db.query.orderItems.findFirst({
			where: eq(orderItems.orderId, orderId),
		});
		return row !== undefined;
	}

	/** Names and SKUs by id, for a bundle's parts on a new order. */
	async productNames(ids: number[]): Promise<Map<number, { name: string; sku: string }>> {
		if (ids.length === 0) return new Map();
		const rows = await Batches.rows(ids, (slice) =>
			this.db
				.select({
					id: products.id,
					label: products.variationLabel,
					name: products.name,
					sku: products.sku,
				})
				.from(products)
				.where(inArray(products.id, slice))
		);
		return new Map(
			rows.map((r) => [r.id, { name: r.label ? `${r.name} (${r.label})` : r.name, sku: r.sku }])
		);
	}

	async setRoyalMailOrderId(orderId: number, royalMailOrderId: string) {
		await this.db.update(orders).set({ royalMailOrderId }).where(eq(orders.id, orderId));
	}

	/**
	 * Writes the items and takes their stock in one atomic batch. False when another delivery of the
	 * same session already wrote them (the batch failed and the items exist), so nothing is doubled.
	 */
	async writeItems(orderId: number, items: NewOrderItem[]): Promise<boolean> {
		// Read before the batch: the stock statements depend on pack sizes and components.
		const stock = new StockService(this.db);
		const stockStatements = await stock.paidStatements(
			items.flatMap((item) =>
				item.productId == null
					? []
					: [{ productId: item.productId, quantity: item.quantity, singleUnits: item.singleUnits }]
			)
		);
		try {
			const [first, ...rest] = [
				...Batches.chunks(items, ITEMS_PER_INSERT).map((slice) =>
					this.db.insert(orderItems).values(slice.map((item) => ({ ...item, orderId })))
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
