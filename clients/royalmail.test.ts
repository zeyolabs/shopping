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
	it('sends the package format, weight and dimensions', async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({ createdOrders: [{ orderIdentifier: 42 }], errorsCount: 0 })
		);
		vi.stubGlobal('fetch', fetchMock);

		const id = await new RoyalMailClient(env).createOrder({
			...order,
			dimensions: { heightMm: 30, lengthMm: 200, widthMm: 100 },
			packageFormat: 'smallParcel',
		});

		expect(id).toBe('42');
		const body = JSON.parse(
			(fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body
		);
		expect(body.items[0].packages).toEqual([
			{
				dimensions: { depthInMms: 200, heightInMms: 30, widthInMms: 100 },
				packageFormatIdentifier: 'smallParcel',
				weightInGrams: 750,
			},
		]);
	});

	it('defaults to a plain parcel with no dimensions', async () => {
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

	it('returns the tracking number, or undefined when untracked', async () => {
		vi.stubGlobal('fetch', async () => Response.json([{ trackingNumber: 'AB123456789GB' }]));
		await expect(new RoyalMailClient(env).trackingNumber('42')).resolves.toBe('AB123456789GB');
		vi.stubGlobal('fetch', async () => Response.json([{}]));
		await expect(new RoyalMailClient(env).trackingNumber('42')).resolves.toBeUndefined();
	});
});
