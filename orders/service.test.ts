import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
import { bundles, orderBundleItems, orderBundles, orderItems, products } from '../db/schema';
import { OrderService } from './service.server';

describe('OrderService.writeItems', () => {
	const { db, order, product } = shopTestDb();

	async function bundleOrder(partCount: number) {
		const row = await order('paid', []);
		const plain = await product({ stock: 10 });
		const parts = [];
		for (let i = 0; i < partCount; i++) {
			const { id } = await product({ stock: 10 });
			parts.push({ name: `Part ${i + 1}`, productId: id, quantity: 1, singleUnits: true });
		}
		const lines = {
			bundles: [{ bundleId: null, name: 'Bundle', parts, quantity: 1, unitPricePence: 1950 }],
			items: [{ name: 'Plain', productId: plain.id, quantity: 2, unitPricePence: 500 }],
		};
		return { lines, parts, plain, row };
	}

	const stockOf = async (id: number) =>
		(await db().select().from(products).where(eq(products.id, id)))[0];

	it('writes 18 parts, a bundle and a plain line in statements under 100 values', async () => {
		const { lines, parts, plain, row } = await bundleOrder(18);
		const batch = vi.spyOn(db(), 'batch');

		expect(await new OrderService(db()).writeItems(row.id, lines)).toBe(true);

		const statements = batch.mock.calls[0][0] as unknown as { toSQL(): { params: unknown[] } }[];
		for (const statement of statements)
			expect(statement.toSQL().params.length).toBeLessThanOrEqual(100);
		const [bundle] = await db().select().from(orderBundles).where(eq(orderBundles.orderId, row.id));
		expect(bundle).toMatchObject({ name: 'Bundle', quantity: 1, unitPricePence: 1950 });
		const stored = await db()
			.select()
			.from(orderBundleItems)
			.where(eq(orderBundleItems.orderBundleId, bundle.id));
		expect(stored).toHaveLength(18);
		expect(stored.every((p) => p.singleUnits)).toBe(true);
		expect(await db().select().from(orderItems).where(eq(orderItems.orderId, row.id))).toHaveLength(
			1
		);
		expect(await stockOf(plain.id)).toMatchObject({ sold: 2, stock: 8 });
		expect(await stockOf(parts[0].productId)).toMatchObject({ sold: 0, stock: 9 });
	});

	it('returns false for a repeated write and leaves stock untouched', async () => {
		const { lines, parts, plain, row } = await bundleOrder(3);
		const service = new OrderService(db());
		expect(await service.writeItems(row.id, lines)).toBe(true);
		expect(await service.writeItems(row.id, lines)).toBe(false);
		expect(await stockOf(plain.id)).toMatchObject({ sold: 2, stock: 8 });
		expect(await stockOf(parts[1].productId)).toMatchObject({ stock: 9 });
		const [, bundleLine] = await service.linesOf(row.id);
		expect(bundleLine.parts).toHaveLength(3);
	});

	it('knows a bundle-only order has items', async () => {
		const { lines, row } = await bundleOrder(2);
		const service = new OrderService(db());
		expect(await service.hasItems(row.id)).toBe(false);
		await service.writeItems(row.id, { bundles: lines.bundles, items: [] });
		expect(await service.hasItems(row.id)).toBe(true);
		expect(await db().select().from(orderItems).where(eq(orderItems.orderId, row.id))).toEqual([]);
	});

	it('merges a bundle built twice into one row with its parts added up', async () => {
		const { lines, parts, row } = await bundleOrder(2);
		const [bundle] = lines.bundles;
		const [{ id: bundleId }] = await db()
			.insert(bundles)
			.values({ createdAt: 0, name: 'Tester', slug: 'tester' })
			.returning();
		const second = { ...bundle, parts: [{ ...parts[0] }, { ...parts[1], quantity: 3 }] };
		const service = new OrderService(db());

		expect(
			await service.writeItems(row.id, {
				bundles: [
					{ ...bundle, bundleId },
					{ ...second, bundleId },
				],
				items: [],
			})
		).toBe(true);

		const [merged] = await service.linesOf(row.id);
		expect(merged).toMatchObject({ quantity: 2, unitPricePence: 1950 });
		expect(merged.parts.map((p) => [p.name, p.quantity])).toEqual([
			['Part 1', 2],
			['Part 2', 4],
		]);
		expect(await stockOf(parts[1].productId)).toMatchObject({ stock: 6 });
	});

	it('lists plain lines then bundles, each by name ignoring case, parts by name', async () => {
		const row = await order('paid', []);
		const a = await product();
		const b = await product();
		const one = await product();
		const two = await product();
		const service = new OrderService(db());
		await service.writeItems(row.id, {
			bundles: [
				{
					bundleId: null,
					name: 'zed kit',
					parts: [
						{ name: 'Beta', productId: two.id, quantity: 1, singleUnits: true },
						{ name: 'alpha', productId: one.id, quantity: 1, singleUnits: true },
					],
					quantity: 1,
					unitPricePence: 900,
				},
			],
			items: [
				{ name: 'banana', productId: b.id, quantity: 1, unitPricePence: 100 },
				{ name: 'Apple', productId: a.id, quantity: 1, unitPricePence: 100 },
			],
		});

		const lines = await service.linesOf(row.id);

		expect(lines.map((l) => l.name)).toEqual(['Apple', 'banana', 'zed kit']);
		expect(lines[2].parts.map((p) => p.name)).toEqual(['alpha', 'Beta']);
		expect(lines[2].kind).toBe('bundle');
	});
});
