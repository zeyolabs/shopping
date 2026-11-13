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
