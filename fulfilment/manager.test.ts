import { beforeEach, describe, expect, it, vi } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
import { FulfilmentService } from './service.server';

const { royalMail, state } = vi.hoisted(() => ({
	royalMail: {
		createOrder: vi.fn(),
		deleteOrder: vi.fn(),
		label: vi.fn(),
		trackingNumber: vi.fn(),
	},
	state: {
		db: undefined as unknown,
		mode: 'api' as 'api' | 'manual',
		orderDispatched: undefined as unknown,
	},
}));

vi.mock('../config', () => ({
	royalMailMode: () => state.mode,
	shopping: () => ({ db: () => state.db, mail: { orderDispatched: state.orderDispatched } }),
}));
const royalMailClient = vi.fn(() => royalMail);
vi.mock('../clients/shop.server', () => ({
	ShopClients: { royalMail: () => royalMailClient() },
}));

const { FulfilmentManager } = await import('./manager.server');

describe('FulfilmentManager.markShippedMany', () => {
	const { db, order } = shopTestDb();
	const orderDispatched = vi.fn();

	beforeEach(() => {
		orderDispatched.mockReset().mockResolvedValue(undefined);
		state.db = db();
		state.mode = 'api';
		royalMailClient.mockClear();
		royalMail.trackingNumber.mockReset().mockResolvedValue(null);
		royalMail.createOrder.mockReset().mockResolvedValue('RM1');
		royalMail.label.mockReset().mockResolvedValue(null);
		royalMail.deleteOrder.mockReset();
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

describe('FulfilmentManager.createLabel', () => {
	const { db, order } = shopTestDb();

	beforeEach(() => {
		state.db = db();
		state.mode = 'api';
		royalMailClient.mockClear();
		royalMail.createOrder.mockReset().mockResolvedValue('RM1');
		royalMail.label.mockReset().mockResolvedValue(null);
	});

	it('pushes the order to Click & Drop in api mode', async () => {
		const paid = await order('paid', []);
		await new FulfilmentService(db()).saveParcel(paid.number, {
			format: 'parcel',
			weightGrams: 300,
		});

		const result = await FulfilmentManager.createLabel(paid.number);

		expect(result).toEqual({ pdf: false, royalMailOrderId: 'RM1' });
		expect(royalMail.createOrder).toHaveBeenCalledTimes(1);
		expect((await new FulfilmentService(db()).find(paid.number))?.labelCreatedAt).not.toBeNull();
	});

	it('refuses in manual mode without touching Royal Mail', async () => {
		state.mode = 'manual';
		const paid = await order('paid', []);

		await expect(FulfilmentManager.createLabel(paid.number)).rejects.toThrow(/Click & Drop/);
		expect(royalMailClient).not.toHaveBeenCalled();
		expect(royalMail.createOrder).not.toHaveBeenCalled();
	});
});

describe('FulfilmentManager.clickAndDropCsv', () => {
	const { db, order } = shopTestDb();

	beforeEach(() => {
		state.db = db();
	});

	it('exports only paid orders and never builds the Royal Mail client', async () => {
		const paid = await order('paid', []);
		const shipped = await order('shipped', []);
		await new FulfilmentService(db()).saveParcel(paid.number, {
			format: 'letter',
			weightGrams: 90,
		});

		const csv = await FulfilmentManager.clickAndDropCsv([paid.number, shipped.number]);

		expect(csv).toContain(paid.number);
		expect(csv).not.toContain(shipped.number);
		expect(csv).toContain(',90,Letter,');
		expect(royalMailClient).not.toHaveBeenCalled();
	});

	it('throws when no order is paid', async () => {
		const shipped = await order('shipped', []);
		await expect(FulfilmentManager.clickAndDropCsv([shipped.number])).rejects.toThrow();
	});
});
