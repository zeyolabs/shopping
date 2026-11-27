import { beforeEach, describe, expect, it, vi } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
import { ClickAndDropRejected } from '../clients/royalmail';
import * as schema from '../db/schema';
import { FulfilmentService } from './service.server';

const { royalMail, state } = vi.hoisted(() => ({
	royalMail: vi.fn(),
	state: { db: undefined as unknown, orderDispatched: undefined as unknown },
}));

vi.mock('../config', () => ({
	shopping: () => ({ db: () => state.db, mail: { orderDispatched: state.orderDispatched } }),
}));
vi.mock('../clients/shop.server', () => ({
	ShopClients: { royalMail },
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

describe('FulfilmentManager Click & Drop preflight', () => {
	const { db, order } = shopTestDb();
	const createOrder = vi.fn();

	beforeEach(async () => {
		royalMail.mockReset().mockReturnValue({
			createOrder,
			deleteOrder: async () => undefined,
			label: async () => new ArrayBuffer(1),
			trackingNumber: async () => null,
		});
		createOrder.mockReset().mockResolvedValue('99');
		state.db = db();
		await db()
			.insert(schema.shippingRates)
			.values({
				maxGrams: 2000,
				name: 'Royal Mail 2nd Class',
				pricePence: 295,
				royalMailServiceCode: 'OLP2',
				service: 'royal-mail-2nd',
				zone: 'uk',
			})
			.onConflictDoNothing();
	});

	async function packed(values: Partial<typeof schema.orders.$inferInsert> = {}) {
		const created = await order('paid', []);
		await new FulfilmentService(db()).update(created.id, {
			shippingService: 'royal-mail-2nd',
			weightGrams: 360,
			...values,
		});
		return created.number;
	}

	it('describes what will be sent and why it is refused', async () => {
		const number = await packed({ packageFormat: 'parcel' });
		expect(await FulfilmentManager.preflight(number)).toMatchObject({
			alreadySent: false,
			check: { ok: false, suggestion: 'largeLetter' },
			format: 'parcel',
			serviceCode: 'OLP2',
			serviceName: 'Royal Mail 2nd Class',
			weightGrams: 360,
			weightIsEstimate: false,
		});
	});

	it('says an order already in Click & Drop is already sent', async () => {
		const number = await packed({ labelCreatedAt: 5, royalMailOrderId: '7' });
		expect((await FulfilmentManager.preflight(number)).alreadySent).toBe(true);
	});

	it('leaves the service to Click & Drop when none is set', async () => {
		const number = await packed({ packageFormat: 'parcel', shippingService: null });
		expect(await FulfilmentManager.preflight(number)).toMatchObject({
			check: { ok: true },
			serviceCode: null,
			serviceName: null,
		});
	});

	it('refuses a doomed label without building the client', async () => {
		const number = await packed({ packageFormat: 'parcel' });
		await expect(FulfilmentManager.createLabel(number)).rejects.toThrow(/does not take the Parcel/);
		expect(royalMail).not.toHaveBeenCalled();
	});

	it('sends an accepted order', async () => {
		const number = await packed({ packageFormat: 'smallParcel' });
		await expect(FulfilmentManager.createLabel(number)).resolves.toMatchObject({
			royalMailOrderId: '99',
		});
		expect(createOrder).toHaveBeenCalledOnce();
	});

	it('turns a Click & Drop rejection into a message for staff', async () => {
		const number = await packed({ packageFormat: 'smallParcel' });
		createOrder.mockRejectedValue(new ClickAndDropRejected(number, 'bad country', 200));
		await expect(FulfilmentManager.createLabel(number)).rejects.toMatchObject({
			message: 'Click & Drop did not accept this order: bad country',
			status: 400,
		});
	});

	it('leaves other failures as they are', async () => {
		const number = await packed({ packageFormat: 'smallParcel' });
		createOrder.mockRejectedValue(new Error('network down'));
		await expect(FulfilmentManager.createLabel(number)).rejects.toThrow('network down');
	});

	it('saves the suggested format and keeps the weight', async () => {
		const number = await packed({ packageFormat: 'parcel' });
		await FulfilmentManager.useSuggestedFormat(number);
		expect(await FulfilmentManager.preflight(number)).toMatchObject({
			check: { ok: true },
			format: 'largeLetter',
			weightGrams: 360,
		});
	});
});
