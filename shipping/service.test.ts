import { describe, expect, it } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
import * as schema from '../db/schema';
import { ShippingService } from './service.server';

const rules = {
	defaultCountry: 'GB',
	freeUkFromPence: 9000,
	insuranceFromPence: 5500,
	insuranceUpliftPence: 300,
	internationalMaxOrderPence: 25000,
};

const t = shopTestDb();

async function seed(rates: Partial<typeof schema.shippingRates.$inferInsert>[]) {
	await t.db().delete(schema.shippingRates);
	await t.db().delete(schema.countries);
	await t
		.db()
		.insert(schema.countries)
		.values({ code: 'GB', enabled: true, name: 'UK', zone: 'uk' });
	await t
		.db()
		.insert(schema.shippingRates)
		.values(
			rates.map((r) => ({
				maxGrams: 750,
				name: 'R',
				pricePence: 0,
				service: 's',
				zone: 'uk' as const,
				...r,
			}))
		);
}

const quote = (format: schema.ShippingFormat, weightGrams = 300) =>
	new ShippingService(t.db()).quote(rules, {
		country: 'GB',
		format,
		subtotalPence: 1000,
		weightGrams,
	});

describe('ShippingService.quote', () => {
	it('skips rates too small for the parcel', async () => {
		await seed([
			{ format: 'largeLetter', name: '2nd large letter', pricePence: 295, service: '2nd' },
			{
				format: 'smallParcel',
				maxGrams: 2000,
				name: '2nd parcel',
				pricePence: 545,
				service: '2nd',
			},
			{
				format: 'mediumParcel',
				maxGrams: 20000,
				name: 'Tracked',
				pricePence: 1795,
				service: 't24',
			},
		]);
		expect((await quote('largeLetter'))?.pricePence).toBe(295);
		expect(await quote('smallParcel')).toMatchObject({ format: 'smallParcel', pricePence: 545 });
		expect((await quote('mediumParcel'))?.pricePence).toBe(1795);
	});

	it('uses a rate with no size for any parcel', async () => {
		await seed([{ format: null, pricePence: 395 }]);
		expect((await quote('mediumParcel'))?.pricePence).toBe(395);
	});

	it('quotes nothing when no rate is big enough', async () => {
		await seed([{ format: 'largeLetter', pricePence: 295 }]);
		expect(await quote('smallParcel')).toBeNull();
	});
});

describe('ShippingService.ukRate', () => {
	it('quotes from the cheapest rate an active product can use', async () => {
		await seed([
			{ format: 'largeLetter', pricePence: 295, service: 'a' },
			{ format: 'smallParcel', pricePence: 545, service: 'b' },
		]);
		await t.product({ shippingFormat: 'smallParcel' });
		await t.product({ active: false, shippingFormat: 'largeLetter' });
		expect((await new ShippingService(t.db()).ukRate())?.pricePence).toBe(545);
	});
});
