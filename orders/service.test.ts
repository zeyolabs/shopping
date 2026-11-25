import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
import { orderItems } from '../db/schema';
import { OrderService } from './service.server';

describe('OrderService.writeItems', () => {
	const { db, order, product } = shopTestDb();

	it('writes a long order in inserts that stay under the 100 values D1 allows', async () => {
		const row = await order('paid', []);
		const items = [];
		for (let i = 0; i < 19; i++) {
			const { id } = await product();
			items.push({
				name: `Part ${i}`,
				productId: id,
				quantity: 1,
				sku: `BUNDLE-1:${i}`,
				unitPricePence: 0,
			});
		}
		const batch = vi.spyOn(db(), 'batch');

		expect(await new OrderService(db()).writeItems(row.id, items)).toBe(true);

		const statements = batch.mock.calls[0][0] as unknown as { toSQL(): { params: unknown[] } }[];
		for (const statement of statements)
			expect(statement.toSQL().params.length).toBeLessThanOrEqual(100);
		expect(await db().select().from(orderItems).where(eq(orderItems.orderId, row.id))).toHaveLength(
			19
		);
	});

	it('reports false when the items were already written', async () => {
		const row = await order('paid', []);
		const { id } = await product();
		const item = { name: 'P', productId: id, quantity: 1, sku: 'A', unitPricePence: 100 };
		const service = new OrderService(db());
		expect(await service.writeItems(row.id, [item])).toBe(true);
		expect(await service.writeItems(row.id, [item])).toBe(false);
	});
});
