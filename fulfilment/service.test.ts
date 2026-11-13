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

describe('FulfilmentService.setRefunded', () => {
	const { db, order } = shopTestDb();

	it('sets the total Stripe reports, is safe to record twice, and flips to refunded at the total', async () => {
		const row = await order('paid', []);
		const fulfilment = new FulfilmentService(db());
		await fulfilment.setRefunded(row.id, 400);
		await fulfilment.setRefunded(row.id, 400);
		let found = await fulfilment.find(row.number);
		expect([found?.refundedPence, found?.status]).toEqual([400, 'paid']);
		await Promise.all([fulfilment.setRefunded(row.id, 1000), fulfilment.setRefunded(row.id, 1000)]);
		found = await fulfilment.find(row.number);
		expect([found?.refundedPence, found?.status]).toEqual([1000, 'refunded']);
	});

	it('never lowers what is recorded', async () => {
		const row = await order('paid', []);
		const fulfilment = new FulfilmentService(db());
		await fulfilment.setRefunded(row.id, 700);
		await fulfilment.setRefunded(row.id, 300);
		expect((await fulfilment.find(row.number))?.refundedPence).toBe(700);
	});
});
