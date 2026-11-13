import { describe, expect, it } from 'vitest';

import { Postage } from './library';

const rules = {
	defaultCountry: 'GB',
	freeUkFromPence: 7000,
	insuranceFromPence: 5500,
	insuranceUpliftPence: 300,
	internationalMaxOrderPence: 25000,
};
const charge = (input: Parameters<typeof Postage.charge>[1]) => Postage.charge(rules, input);

describe('Postage.charge', () => {
	it('charges the base UK rate below £70 and nothing from £70', () => {
		expect(charge({ basePence: 450, subtotalPence: 6999, zone: 'uk' })).toBe(450);
		expect(charge({ basePence: 450, subtotalPence: 7000, zone: 'uk' })).toBe(0);
	});

	it('adds the insurance uplift internationally from £55', () => {
		expect(charge({ basePence: 1285, subtotalPence: 5499, zone: 'europe_eu' })).toBe(1285);
		expect(charge({ basePence: 1285, subtotalPence: 5500, zone: 'europe_eu' })).toBe(1585);
	});

	it('refuses international orders worth £250 or more', () => {
		expect(charge({ basePence: 2255, subtotalPence: 25000, zone: 'world' })).toBeNull();
	});

	it('does not apply the international cap to the UK', () => {
		expect(charge({ basePence: 450, subtotalPence: 99999, zone: 'uk' })).toBe(0);
	});
});
