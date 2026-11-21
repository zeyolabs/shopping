import { afterEach, describe, expect, it, vi } from 'vitest';

import { RoyalMailClient } from './royalmail';

const env = 'key';

const order = {
	address: {
		city: 'London',
		country: 'GB',
		line1: '1 High St',
		name: 'A Person',
		postal_code: 'N1 1AA',
	},
	createdAt: 0,
	email: 'a@example.com',
	number: 'PL-ABC123',
	serviceCode: null,
	shippingPence: 0,
	subtotalPence: 1000,
	totalPence: 1000,
	weightGrams: 750,
};

afterEach(() => vi.unstubAllGlobals());

describe('Click & Drop client', () => {
	it('sends the package format and weight', async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({ createdOrders: [{ orderIdentifier: 42 }], errorsCount: 0 })
		);
		vi.stubGlobal('fetch', fetchMock);

		const id = await new RoyalMailClient(env).createOrder({
			...order,
			packageFormat: 'smallParcel',
		});

		expect(id).toBe('42');
		const body = JSON.parse(
			(fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body
		);
		expect(body.items[0].packages).toEqual([
			{ packageFormatIdentifier: 'smallParcel', weightInGrams: 750 },
		]);
	});

	it('defaults to a plain parcel', async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({ createdOrders: [{ orderIdentifier: 7 }], errorsCount: 0 })
		);
		vi.stubGlobal('fetch', fetchMock);
		await new RoyalMailClient(env).createOrder(order);
		const body = JSON.parse(
			(fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body
		);
		expect(body.items[0].packages).toEqual([
			{ packageFormatIdentifier: 'parcel', weightInGrams: 750 },
		]);
	});

	it('returns the label, or null when the account may not download labels', async () => {
		vi.stubGlobal('fetch', async () => new Response(new Uint8Array([1, 2]), { status: 200 }));
		await expect(new RoyalMailClient(env).label('42')).resolves.toBeInstanceOf(ArrayBuffer);
		vi.stubGlobal('fetch', async () => new Response(null, { status: 403 }));
		await expect(new RoyalMailClient(env).label('42')).resolves.toBeNull();
	});

	it('returns the tracking number, or undefined when untracked', async () => {
		vi.stubGlobal('fetch', async () => Response.json([{ trackingNumber: 'AB123456789GB' }]));
		await expect(new RoyalMailClient(env).trackingNumber('42')).resolves.toBe('AB123456789GB');
		vi.stubGlobal('fetch', async () => Response.json([{}]));
		await expect(new RoyalMailClient(env).trackingNumber('42')).resolves.toBeUndefined();
	});
});
