import { mockD1 } from '@zeyolabs/kit/cloudflare/d1/testing';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import type { ShopDb } from '../db';

import * as schema from '../db/schema';
import { MAX_COMPONENTS, sellableSql, StockService } from './stock-service';

// The two tables the stock code touches. Shopping ships no migrations (each app generates its own
// from the schema), so the test builds just these by hand.
const MIGRATIONS = [
	`CREATE TABLE products (
		id integer PRIMARY KEY AUTOINCREMENT, active integer NOT NULL DEFAULT 1, compare_price_pence integer,
		created_at integer NOT NULL, description text NOT NULL DEFAULT '', low_stock_threshold integer,
		mass_grams integer NOT NULL DEFAULT 0, max_per_order integer NOT NULL DEFAULT 10, name text NOT NULL,
		pack_size integer NOT NULL DEFAULT 1, price_pence integer NOT NULL, restocked_at integer,
		short_description text NOT NULL DEFAULT '', sku text NOT NULL UNIQUE, slug text NOT NULL UNIQUE,
		sold integer NOT NULL DEFAULT 0, sort_order integer NOT NULL DEFAULT 0, stock integer NOT NULL DEFAULT 0,
		variation_group_id integer, variation_label text)`,
	`CREATE TABLE order_items (
		id integer PRIMARY KEY AUTOINCREMENT, name text NOT NULL, order_id integer NOT NULL,
		product_id integer, quantity integer NOT NULL, sku text NOT NULL, unit_price_pence integer NOT NULL)`,
	'CREATE UNIQUE INDEX order_items_order_sku_unique ON order_items (order_id, sku)',
	`CREATE TABLE product_components (
		component_id integer NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
		product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
		quantity integer NOT NULL DEFAULT 1, PRIMARY KEY (product_id, component_id))`,
];

describe('StockService', () => {
	const ctx = mockD1({ migrations: MIGRATIONS, schema });
	const service = () => new StockService(ctx.db as unknown as ShopDb);
	const db = () => ctx.db as unknown as ShopDb;
	let counter = 0;

	async function product(values: { packSize?: number; stock?: number } = {}) {
		counter++;
		const [row] = await db()
			.insert(schema.products)
			.values({
				createdAt: 1,
				name: `Product ${counter}`,
				packSize: values.packSize ?? 1,
				pricePence: 100,
				sku: `SKU${counter}`,
				slug: `product-${counter}`,
				stock: values.stock ?? 0,
			})
			.returning();
		return row;
	}

	const read = async (id: number) =>
		(await db().select().from(schema.products).where(eq(schema.products.id, id)))[0];

	it('available: whole packs of a plain product', async () => {
		const plain = await product({ stock: 7 });
		const packs = await product({ packSize: 10, stock: 35 });
		const map = await service().availableMany([plain.id, packs.id, 99999]);
		expect(map.get(plain.id)).toBe(7);
		expect(map.get(packs.id)).toBe(3);
		expect(map.has(99999)).toBe(false);
		expect(await service().available(packs.id)).toBe(3);
	});

	it('available: complete sets of a combined product', async () => {
		const a = await product({ stock: 5 });
		const b = await product({ stock: 7 });
		const set = await product();
		await service().setComponents(set.id, [
			{ componentId: a.id, quantity: 1 },
			{ componentId: b.id, quantity: 2 },
		]);
		expect(await service().available(set.id)).toBe(3);
		expect((await service().components(set.id)).map((c) => c.componentId).sort()).toEqual(
			[a.id, b.id].sort()
		);
	});

	it('setStock sets restockedAt only when the product becomes sellable', async () => {
		const p = await product({ packSize: 10, stock: 0 });
		await service().setStock(p.id, 5, 1000);
		expect((await read(p.id)).restockedAt).toBeNull();
		await service().setStock(p.id, 10, 2000);
		expect((await read(p.id)).restockedAt).toBe(2000);
		await service().setStock(p.id, 30, 3000);
		expect((await read(p.id)).restockedAt).toBe(2000);
		await service().setStock(p.id, 0, 4000);
		await service().setStock(p.id, 20, 5000);
		expect((await read(p.id)).restockedAt).toBe(5000);
	});

	it('setStock throws 404 for an unknown product', async () => {
		await expect(service().setStock(999999, 1)).rejects.toThrow('not found');
	});

	it('paidStatements decrements stock in units, floors at 0 and counts sold', async () => {
		const plain = await product({ stock: 3 });
		const packs = await product({ packSize: 10, stock: 25 });
		const statements = await service().paidStatements([
			{ productId: plain.id, quantity: 5 },
			{ productId: packs.id, quantity: 2 },
		]);
		await db().batch(statements as [(typeof statements)[number], ...typeof statements]);
		expect(await read(plain.id)).toMatchObject({ sold: 5, stock: 0 });
		expect(await read(packs.id)).toMatchObject({ sold: 2, stock: 5 });
	});

	it('paidStatements decrements the components of a combined product, at the component cap', async () => {
		const components = [];
		for (let i = 0; i < MAX_COMPONENTS; i++) components.push(await product({ stock: 10 }));
		const set = await product();
		await service().setComponents(
			set.id,
			components.map((c) => ({ componentId: c.id, quantity: 2 }))
		);
		expect(await service().available(set.id)).toBe(5);

		const statements = await service().paidStatements([{ productId: set.id, quantity: 3 }]);
		await db().batch(statements as [(typeof statements)[number], ...typeof statements]);
		for (const c of components) expect((await read(c.id)).stock).toBe(4);
		expect(await read(set.id)).toMatchObject({ sold: 3, stock: 0 });
		expect(await service().available(set.id)).toBe(2);
	});

	it('setComponents enforces the cap, repeats, self-reference and nesting', async () => {
		const set = await product();
		const many = [];
		for (let i = 0; i <= MAX_COMPONENTS; i++) many.push(await product({ stock: 1 }));
		await expect(
			service().setComponents(
				set.id,
				many.map((c) => ({ componentId: c.id, quantity: 1 }))
			)
		).rejects.toThrow('at most');
		await expect(
			service().setComponents(set.id, [
				{ componentId: many[0].id, quantity: 1 },
				{ componentId: many[0].id, quantity: 1 },
			])
		).rejects.toThrow('once');
		await expect(
			service().setComponents(set.id, [{ componentId: set.id, quantity: 1 }])
		).rejects.toThrow('itself');
		await expect(
			service().setComponents(set.id, [{ componentId: many[0].id, quantity: 0 }])
		).rejects.toThrow('whole number');

		const outer = await product();
		await service().setComponents(set.id, [{ componentId: many[0].id, quantity: 1 }]);
		await expect(
			service().setComponents(outer.id, [{ componentId: set.id, quantity: 1 }])
		).rejects.toThrow('combined');
	});

	it('setComponents refuses a product that is already a component of another set', async () => {
		const part = await product({ stock: 3 });
		const outer = await product();
		await service().setComponents(outer.id, [{ componentId: part.id, quantity: 1 }]);
		const other = await product({ stock: 1 });
		await expect(
			service().setComponents(part.id, [{ componentId: other.id, quantity: 1 }])
		).rejects.toThrow('component of another set');
	});

	it('a repeated order batch fails on the items and leaves stock and sold untouched', async () => {
		const p = await product({ stock: 10 });
		const items = [
			{ name: 'Item', orderId: 77, productId: p.id, quantity: 2, sku: 'DUP', unitPricePence: 100 },
		];
		const write = async () => {
			const statements = await service().paidStatements([{ productId: p.id, quantity: 2 }]);
			await db().batch([db().insert(schema.orderItems).values(items), ...statements]);
		};
		await write();
		expect(await read(p.id)).toMatchObject({ sold: 2, stock: 8 });
		await expect(write()).rejects.toThrow();
		expect(await read(p.id)).toMatchObject({ sold: 2, stock: 8 });
	});

	it('setComponents with an empty list makes it a plain product again', async () => {
		const part = await product({ stock: 4 });
		const set = await product({ stock: 9 });
		await service().setComponents(set.id, [{ componentId: part.id, quantity: 1 }]);
		expect(await service().available(set.id)).toBe(4);
		await service().setComponents(set.id, []);
		expect(await service().available(set.id)).toBe(9);
	});

	it('sellableSql matches plain, pack and combined availability', async () => {
		const out = await product({ packSize: 10, stock: 9 });
		const inn = await product({ packSize: 10, stock: 10 });
		const part = await product({ stock: 0 });
		const set = await product();
		await service().setComponents(set.id, [{ componentId: part.id, quantity: 1 }]);
		const ids = [out.id, inn.id, set.id];
		const rows = await db()
			.select({ id: schema.products.id, sellable: sql<number>`${sellableSql}` })
			.from(schema.products)
			.where(sql`${schema.products.id} in (${sql.join(ids, sql`, `)})`);
		const byId = new Map(rows.map((r) => [r.id, Boolean(r.sellable)]));
		expect(byId.get(out.id)).toBe(false);
		expect(byId.get(inn.id)).toBe(true);
		expect(byId.get(set.id)).toBe(false);
		await service().setStock(part.id, 1);
		const after = await db()
			.select({ sellable: sql<number>`${sellableSql}` })
			.from(schema.products)
			.where(eq(schema.products.id, set.id));
		expect(Boolean(after[0].sellable)).toBe(true);
	});
});
