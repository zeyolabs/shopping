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

describe('FulfilmentService filters and counts', () => {
	const { db, order } = shopTestDb();

	it('splits paid orders into to ship, ready to dispatch and on hold', async () => {
		const fulfilment = new FulfilmentService(db());
		const fresh = await order('paid', []);
		const labelled = await order('paid', []);
		const held = await order('paid', []);
		const heldLabelled = await order('paid', []);
		const shipped = await order('shipped', []);
		await fulfilment.update(labelled.id, { labelCreatedAt: 5 });
		await fulfilment.update(held.id, { heldAt: 5 });
		await fulfilment.update(heldLabelled.id, { heldAt: 5, labelCreatedAt: 5 });

		const numbers = async (filter: Parameters<FulfilmentService['list']>[0]) =>
			(await fulfilment.list(filter, '')).map((o) => o.number).sort();
		expect(await numbers('ready')).toEqual([labelled.number]);
		expect(await numbers('on-hold')).toEqual([held.number, heldLabelled.number].sort());
		expect(await numbers('to-ship')).toEqual(
			[fresh.number, labelled.number, held.number, heldLabelled.number].sort()
		);
		expect(await numbers('shipped')).toEqual([shipped.number]);

		expect(await fulfilment.counts()).toEqual({
			all: 5,
			'on-hold': 2,
			ready: 1,
			shipped: 1,
			'to-ship': 4,
		});
	});
});

describe('FulfilmentService.counts on an empty shop', () => {
	const { db } = shopTestDb();

	it('counts are zero, not null, with no orders', async () => {
		expect(await new FulfilmentService(db()).counts()).toEqual({
			all: 0,
			'on-hold': 0,
			ready: 0,
			shipped: 0,
			'to-ship': 0,
		});
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
