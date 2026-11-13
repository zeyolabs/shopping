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
		expect(result.labelAffected).toBe(true);
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
		expect(result.labelAffected).toBe(false);
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
