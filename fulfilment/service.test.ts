import { describe, expect, it } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
import { FulfilmentService } from './service.server';

describe('FulfilmentService.list', () => {
	const { db, order } = shopTestDb();

	it('matches % and _ in a search literally', async () => {
		await order('paid', [], 'a_b@shop.test');
		await order('paid', [], 'axb@shop.test');
		const fulfilment = new FulfilmentService(db());
		expect((await fulfilment.list('all', 'a_b')).map((o) => o.email)).toEqual(['a_b@shop.test']);
		expect(await fulfilment.list('all', '100%')).toEqual([]);
		expect(await fulfilment.list('to-ship', 'shop.test')).toHaveLength(2);
	});
});

describe('FulfilmentService.recordRefund', () => {
	const { db, order } = shopTestDb();

	it('adds partial refunds and marks the order refunded when the total is reached', async () => {
		const row = await order('paid', []);
		const fulfilment = new FulfilmentService(db());
		await fulfilment.recordRefund(row.id, 400);
		let found = await fulfilment.find(row.number);
		expect([found?.refundedPence, found?.status]).toEqual([400, 'paid']);
		await fulfilment.recordRefund(row.id, 600);
		found = await fulfilment.find(row.number);
		expect([found?.refundedPence, found?.status]).toEqual([1000, 'refunded']);
	});
});
