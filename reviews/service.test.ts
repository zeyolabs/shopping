import { describe, expect, it } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
import * as schema from '../db/schema';
import { ReviewService } from './service.server';

describe('ReviewService', () => {
	const { db, order, product } = shopTestDb();

	it('lets a buyer review each item once and shows it only when approved', async () => {
		const p = await product();
		const other = await product();
		const o = await order('paid', [p.id]);
		const reviews = new ReviewService(db());
		const input = {
			body: 'Lovely tea, would buy again',
			name: 'Ann',
			productId: p.id,
			rating: 4,
			title: '',
		};
		expect(await reviews.submit(o.id, input)).toBe(true);
		expect(await reviews.submit(o.id, input)).toBe(false);
		expect(await reviews.submit(o.id, { ...input, productId: other.id })).toBe(false);
		expect((await reviews.forOrder(o.id))[0].review?.status).toBe('pending');

		expect((await reviews.forProduct(p.id)).count).toBe(0);
		const [pending] = await reviews.list('pending');
		await reviews.moderate(pending.id, 'approved');
		expect(await reviews.forProduct(p.id)).toMatchObject({ average: 4, count: 1 });
		expect(await reviews.list('pending')).toEqual([]);
	});

	it('lists, moderates and averages a review that has no order, such as an imported one', async () => {
		const p = await product();
		const reviews = new ReviewService(db());
		await db().insert(schema.reviews).values({
			body: 'Great stabilisers',
			createdAt: 1,
			name: 'Sam',
			orderId: null,
			productId: p.id,
			rating: 5,
			status: 'pending',
		});
		const [pending] = await reviews.list('pending');
		expect(pending).toMatchObject({ email: null, name: 'Sam', orderNumber: null });
		await reviews.moderate(pending.id, 'approved');
		expect(await reviews.forProduct(p.id)).toMatchObject({ average: 5, count: 1 });
	});

	it('refuses cancelled orders', async () => {
		const p = await product();
		const o = await order('cancelled', [p.id]);
		const reviews = new ReviewService(db());
		const ok = await reviews.submit(o.id, {
			body: 'Should not be saved',
			name: 'B',
			productId: p.id,
			rating: 5,
			title: '',
		});
		expect(ok).toBe(false);
	});
});
