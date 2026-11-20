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

async function seed(rates: Omit<typeof schema.shippingRates.$inferInsert, 'zone'>[]) {
	await t
		.db()
		.insert(schema.countries)
		.values({ code: 'GB', enabled: true, name: 'UK', zone: 'uk' });
	await t
		.db()
		.insert(schema.shippingRates)
		.values(rates.map((r) => ({ ...r, zone: 'uk' as const })));
}

const quotes = (weightGrams: number, subtotalPence = 1000) =>
	new ShippingService(t.db()).quotes(rules, { country: 'GB', subtotalPence, weightGrams });

describe('ShippingService.quotes', () => {
	it('offers each service once, at its cheapest band, cheapest first', async () => {
		await seed([
			{ maxGrams: 2000, name: '1st Class', pricePence: 695, service: '1st' },
			{ maxGrams: 750, name: '2nd Class', pricePence: 295, service: '2nd' },
			{ maxGrams: 2000, name: '2nd Class', pricePence: 545, service: '2nd' },
			{ maxGrams: 2000, name: 'Tracked 24', pricePence: 595, service: 't24' },
			{ maxGrams: 20000, name: 'Tracked 24', pricePence: 1795, service: 't24' },
		]);
		expect((await quotes(500)).map((q) => [q.service, q.pricePence])).toEqual([
			['2nd', 295],
			['t24', 595],
			['1st', 695],
		]);
		expect((await quotes(1500)).map((q) => q.pricePence)).toEqual([545, 595, 695]);
		expect((await quotes(5000)).map((q) => [q.service, q.pricePence])).toEqual([['t24', 1795]]);
		expect(await quotes(25000)).toEqual([]);
	});

	it('makes every option free over the free-delivery threshold', async () => {
		expect((await quotes(500, 9000)).map((q) => q.pricePence)).toEqual([0, 0, 0]);
	});

	it('offers nothing to a country that is not enabled', async () => {
		const none = await new ShippingService(t.db()).quotes(rules, {
			country: 'FR',
			subtotalPence: 1000,
			weightGrams: 500,
		});
		expect(none).toEqual([]);
	});
});
