import { Error400, Error404 } from '@zeyolabs/kit/utils/errors';
import { asc, count, eq, inArray, sql } from 'drizzle-orm';

import type { ShopDb } from '../db/index';

import { productComponents, products, stockAlerts } from '../db/schema';
import { Stock, type StockComponent } from './library';

/** A combined product takes at most this many components (keeps every statement well under D1's limits). */
export const MAX_COMPONENTS = 10;

type ComponentRow = StockComponent & { componentId: number };

/** The part of a paid order line the stock cares about. */
export type PaidLine = { productId: number; quantity: number };

/**
 * SQL for "this product can be bought right now": a plain product has at least one whole pack, a
 * combined product has every component stocked for one set. Used where a query filters on it.
 */
export const sellableSql = sql`(case when exists (select 1 from ${productComponents} pc where pc.product_id = ${products.id})
	then not exists (select 1 from ${productComponents} pc join ${products} c on c.id = pc.component_id
		where pc.product_id = ${products.id} and c.stock < pc.quantity * c.pack_size)
	else ${products.stock} >= ${products.packSize} end)`;

/**
 * Stock data access: what can be sold, the decrement when an order is paid, and the one write path
 * for stock edits. It takes the db it works on, checks no permissions and sends nothing.
 */
export class StockService {
	constructor(private readonly db: ShopDb) {}

	/** What can be sold of one product right now (whole packs, or complete sets if it is combined). */
	async available(productId: number): Promise<number> {
		return (await this.availableMany([productId])).get(productId) ?? 0;
	}

	/** Sellable count per product id. Unknown ids are left out. */
	async availableMany(ids: readonly number[]): Promise<Map<number, number>> {
		const result = new Map<number, number>();
		if (ids.length === 0) return result;
		const rows = await this.db
			.select({ id: products.id, packSize: products.packSize, stock: products.stock })
			.from(products)
			.where(inArray(products.id, [...ids]));
		const components = await this.componentsOf(rows.map((r) => r.id));
		for (const row of rows) {
			const parts = components.get(row.id);
			result.set(
				row.id,
				parts ? Stock.combinedAvailable(parts) : Stock.sellable(row.stock, row.packSize)
			);
		}
		return result;
	}

	/** The components of a combined product, or an empty list for a plain one. */
	async components(productId: number): Promise<ComponentRow[]> {
		return (await this.componentsOf([productId])).get(productId) ?? [];
	}

	/** Every product with its stock and how many customers are waiting for it, sold-out first. */
	async list() {
		return this.db
			.select({
				active: products.active,
				id: products.id,
				name: products.name,
				sku: products.sku,
				stock: products.stock,
				variationLabel: products.variationLabel,
				waiting: sql<number>`(select ${count()} from ${stockAlerts} where ${stockAlerts.productId} = ${products.id})`,
			})
			.from(products)
			.orderBy(asc(sql`${products.stock} > 0`), asc(products.name), asc(products.id));
	}

	/**
	 * The statements that take a paid order's stock: each line's product (or, for a combined product,
	 * its components) loses stock, floored at 0, and the product's `sold` goes up. They are returned
	 * rather than run, so the caller writes them in the same atomic `db.batch` as the order items.
	 */
	async paidStatements(lines: readonly PaidLine[]) {
		const ids = lines.map((l) => l.productId);
		const [rows, components] = await Promise.all([
			ids.length > 0
				? this.db
						.select({ id: products.id, packSize: products.packSize })
						.from(products)
						.where(inArray(products.id, ids))
				: [],
			this.componentsOf(ids),
		]);
		const packSize = new Map(rows.map((r) => [r.id, r.packSize]));
		const statements = [];
		for (const line of lines) {
			const parts = components.get(line.productId);
			if (parts) {
				for (const part of parts) {
					statements.push(
						this.decrement(part.componentId, line.quantity * part.quantity * part.packSize)
					);
				}
			} else {
				statements.push(
					this.decrement(line.productId, line.quantity * (packSize.get(line.productId) ?? 1))
				);
			}
			statements.push(
				this.db
					.update(products)
					.set({ sold: sql`${products.sold} + ${line.quantity}` })
					.where(eq(products.id, line.productId))
			);
		}
		return statements;
	}

	/**
	 * Replaces a combined product's components. At most `MAX_COMPONENTS`, no repeats, and a product
	 * cannot contain itself or another combined product. An empty list makes it a plain product again.
	 */
	async setComponents(
		productId: number,
		components: readonly { componentId: number; quantity: number }[]
	) {
		if (components.length > MAX_COMPONENTS) {
			throw Error400(`A combined product has at most ${MAX_COMPONENTS} components.`);
		}
		const ids = components.map((c) => c.componentId);
		if (new Set(ids).size !== ids.length) throw Error400('A component can only be listed once.');
		if (ids.includes(productId)) throw Error400('A product cannot contain itself.');
		if (components.some((c) => !Number.isInteger(c.quantity) || c.quantity < 1)) {
			throw Error400('Each component quantity must be a whole number of at least 1.');
		}
		if (ids.length > 0) {
			const nested = await this.componentsOf(ids);
			if (nested.size > 0) throw Error400('A component cannot itself be a combined product.');
		}
		if (components.length > 0) {
			const usedAsComponent = await this.db
				.select({ productId: productComponents.productId })
				.from(productComponents)
				.where(eq(productComponents.componentId, productId))
				.limit(1);
			if (usedAsComponent.length > 0) {
				throw Error400('A product that is a component of another set cannot be combined itself.');
			}
		}
		await this.db.batch([
			this.db.delete(productComponents).where(eq(productComponents.productId, productId)),
			...(components.length > 0
				? [this.db.insert(productComponents).values(components.map((c) => ({ ...c, productId })))]
				: []),
		]);
	}

	/**
	 * Sets a product's stock in single units. This is the only write path for stock edits (the admin
	 * page and imports go through it): `restockedAt` is set in the same statement when the product
	 * goes from not sellable to sellable, so it cannot drift.
	 */
	async setStock(productId: number, units: number, now = Date.now()): Promise<void> {
		const updated = await this.db
			.update(products)
			.set({
				restockedAt: sql`case when ${products.stock} < ${products.packSize} and ${units} >= ${products.packSize} then ${now} else ${products.restockedAt} end`,
				stock: units,
			})
			.where(eq(products.id, productId))
			.returning({ id: products.id });
		if (updated.length === 0) throw Error404('Product not found.');
	}

	private async componentsOf(ids: readonly number[]): Promise<Map<number, ComponentRow[]>> {
		const map = new Map<number, ComponentRow[]>();
		if (ids.length === 0) return map;
		const rows = await this.db
			.select({
				componentId: productComponents.componentId,
				packSize: products.packSize,
				productId: productComponents.productId,
				quantity: productComponents.quantity,
				stock: products.stock,
			})
			.from(productComponents)
			.innerJoin(products, eq(products.id, productComponents.componentId))
			.where(inArray(productComponents.productId, [...ids]));
		for (const row of rows) {
			const list = map.get(row.productId) ?? [];
			list.push({
				componentId: row.componentId,
				packSize: row.packSize,
				quantity: row.quantity,
				stock: row.stock,
			});
			map.set(row.productId, list);
		}
		return map;
	}

	private decrement(productId: number, units: number) {
		return this.db
			.update(products)
			.set({ stock: sql`max(${products.stock} - ${units}, 0)` })
			.where(eq(products.id, productId));
	}
}
