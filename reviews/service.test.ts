import { describe, expect, it } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
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
		expect((await reviews.summaries([p.id])).get(p.id)).toEqual({ average: 4, count: 1 });
		expect(await reviews.countPending()).toBe(0);
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
