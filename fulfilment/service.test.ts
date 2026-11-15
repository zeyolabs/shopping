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

describe('FulfilmentService.saveDetails', () => {
	const { db, order } = shopTestDb();
	const details = {
		city: 'Leeds',
		country: 'GB',
		email: 'a@b.test',
		line1: '2 New St',
		line2: '',
		name: 'A',
		phone: '',
		postcode: 'LS1',
		shippingService: '',
	};

	it('updates the address and email and says the label is affected', async () => {
		const row = await order('paid', []);
		const fulfilment = new FulfilmentService(db());
		const result = await fulfilment.saveDetails(row.number, { ...details, email: 'new@b.test' });
		expect(result.labelStale).toBe(false); // no label yet
		const found = await fulfilment.find(row.number);
		expect(found?.email).toBe('new@b.test');
		expect(found?.address.line1).toBe('2 New St');
		expect(found?.address.line2).toBeNull();
	});

	it('reports no label change when nothing Click & Drop holds changed', async () => {
		const row = await order('paid', []);
		const fulfilment = new FulfilmentService(db());
		const result = await fulfilment.saveDetails(row.number, {
			...details,
			city: 'X',
			line1: '1',
			postcode: 'N1',
		});
		expect(result.labelStale).toBe(false);
	});

	it('clears the label of a paid order in the same call when its address changes', async () => {
		const row = await order('paid', []);
		const fulfilment = new FulfilmentService(db());
		await fulfilment.update(row.id, { labelCreatedAt: 5, royalMailOrderId: 'RM1' });
		const same = await fulfilment.saveDetails(row.number, {
			...details,
			city: 'X',
			line1: '1',
			postcode: 'N1',
		});
		expect(same.labelStale).toBe(false);
		expect((await fulfilment.find(row.number))?.labelCreatedAt).toBe(5);
		const changed = await fulfilment.saveDetails(row.number, details);
		expect(changed.labelStale).toBe(true);
		const found = await fulfilment.find(row.number);
		expect([found?.labelCreatedAt, found?.royalMailOrderId]).toEqual([null, 'RM1']);
	});

	it('does not flag a shipped order, and a case-only email change is not a change', async () => {
		const shipped = await order('shipped', [], 'Mixed@Case.test');
		const fulfilment = new FulfilmentService(db());
		await fulfilment.update(shipped.id, { labelCreatedAt: 5 });
		const result = await fulfilment.saveDetails(shipped.number, details);
		expect(result.labelStale).toBe(false);
		const paid = await order('paid', [], 'Mixed@Case.test');
		await fulfilment.update(paid.id, { labelCreatedAt: 5 });
		const same = await fulfilment.saveDetails(paid.number, {
			...details,
			city: 'X',
			email: 'mixed@case.test',
			line1: '1',
			postcode: 'N1',
		});
		expect(same.labelStale).toBe(false);
	});

	it('keeps the current postage service when the field is blank', async () => {
		const row = await order('paid', []);
		const fulfilment = new FulfilmentService(db());
		await fulfilment.update(row.id, { shippingService: 'tracked-48' });
		await fulfilment.saveDetails(row.number, { ...details, shippingService: '' });
		expect((await fulfilment.find(row.number))?.shippingService).toBe('tracked-48');
	});

	it('only edits tracking when it is given, and refuses cancelled orders', async () => {
		const shipped = await order('shipped', []);
		const fulfilment = new FulfilmentService(db());
		await fulfilment.saveDetails(shipped.number, { ...details, trackingNumber: 'AB123456789GB' });
		expect((await fulfilment.find(shipped.number))?.trackingNumber).toBe('AB123456789GB');
		await fulfilment.saveDetails(shipped.number, details);
		expect((await fulfilment.find(shipped.number))?.trackingNumber).toBe('AB123456789GB');

		const cancelled = await order('cancelled', []);
		await expect(fulfilment.saveDetails(cancelled.number, details)).rejects.toThrow();
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
		const unpaid = await order('pending', []);
		await fulfilment.update(labelled.id, { labelCreatedAt: 5, shippingService: 'Tracked 48' });
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
		expect(await numbers('unpaid')).toEqual([unpaid.number]);
		expect(await fulfilment.readyByService()).toEqual({ 'Tracked 48': 1 });

		expect(await fulfilment.counts()).toEqual({
			all: 6,
			'on-hold': 2,
			ready: 1,
			shipped: 1,
			'to-ship': 4,
			unpaid: 1,
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
			unpaid: 0,
		});
		expect(await new FulfilmentService(db()).readyByService()).toEqual({});
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
