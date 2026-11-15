import { beforeEach, describe, expect, it, vi } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
import { FulfilmentService } from './service.server';

const { state } = vi.hoisted(() => ({
	state: { db: undefined as unknown, orderDispatched: undefined as unknown },
}));

vi.mock('../config', () => ({
	shopping: () => ({ db: () => state.db, mail: { orderDispatched: state.orderDispatched } }),
}));
vi.mock('../clients/shop.server', () => ({
	ShopClients: { royalMail: () => ({ trackingNumber: async () => null }) },
}));

const { FulfilmentManager } = await import('./manager.server');

describe('FulfilmentManager.markShippedMany', () => {
	const { db, order } = shopTestDb();
	const orderDispatched = vi.fn();

	beforeEach(() => {
		orderDispatched.mockReset().mockResolvedValue(undefined);
		state.db = db();
		state.orderDispatched = orderDispatched;
	});

	it('ships only orders that are ready, and reports the rest', async () => {
		const fulfilment = new FulfilmentService(db());
		const ready = await order('paid', []);
		const unlabelled = await order('paid', []);
		const held = await order('paid', []);
		const shipped = await order('shipped', []);
		await fulfilment.update(ready.id, { labelCreatedAt: 5 });
		await fulfilment.update(held.id, { heldAt: 5, labelCreatedAt: 5 });
		await fulfilment.update(shipped.id, { labelCreatedAt: 5 });

		const results = await FulfilmentManager.markShippedMany(
			[ready.number, unlabelled.number, held.number, shipped.number, 'NOPE'],
			{ email: true }
		);

		expect(results.map((r) => [r.number, r.ok])).toEqual([
			[ready.number, true],
			[unlabelled.number, false],
			[held.number, false],
			[shipped.number, false],
			['NOPE', false],
		]);
		expect((await fulfilment.find(ready.number))?.status).toBe('shipped');
		expect((await fulfilment.find(unlabelled.number))?.status).toBe('paid');
		expect((await fulfilment.find(held.number))?.status).toBe('paid');
		expect(orderDispatched).toHaveBeenCalledTimes(1);
	});

	it('sends no email with email: false', async () => {
		const fulfilment = new FulfilmentService(db());
		const ready = await order('paid', []);
		await fulfilment.update(ready.id, { labelCreatedAt: 5 });

		const results = await FulfilmentManager.markShippedMany([ready.number], { email: false });

		expect(results).toEqual([{ emailed: false, number: ready.number, ok: true }]);
		expect((await fulfilment.find(ready.number))?.status).toBe('shipped');
		expect(orderDispatched).not.toHaveBeenCalled();
	});

	it('refuses more than the limit', async () => {
		const numbers = Array.from({ length: 21 }, (_, i) => `N${i}`);
		await expect(FulfilmentManager.markShippedMany(numbers, { email: true })).rejects.toThrow();
	});
});
