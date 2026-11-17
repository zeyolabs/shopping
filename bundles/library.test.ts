import { describe, expect, it } from 'vitest';

import { BundleParts, BundleSku } from './library';

describe('BundleSku', () => {
	it('reads an optional slot count and kit price, and writes it back', () => {
		expect(BundleSku.parse('BASE44=16')).toEqual({ pricePence: null, sku: 'BASE44', slots: 16 });
		expect(BundleSku.parse(' POM ')).toEqual({ pricePence: null, sku: 'POM', slots: null });
		expect(BundleSku.parse('A=0')).toEqual({ pricePence: null, sku: 'A', slots: null });
		expect(BundleSku.parse('CASE=35@37.00')).toEqual({ pricePence: 3700, sku: 'CASE', slots: 35 });
		expect(BundleSku.format({ pricePence: 3700, sku: 'CASE', slots: 35 })).toBe('CASE=35@37.00');
		expect(BundleSku.format({ pricePence: null, sku: 'POM', slots: null })).toBe('POM');
	});
});

describe('BundleParts', () => {
	it('round-trips and drops junk', () => {
		const parts = [
			{ productId: 3, quantity: 1, singleUnits: false },
			{ productId: 12, quantity: 16, singleUnits: true },
		];
		expect(BundleParts.decode(BundleParts.encode(parts))).toEqual(parts);
		expect(BundleParts.decode('x|5:0:1|7:2:0')).toEqual([
			{ productId: 7, quantity: 2, singleUnits: false },
		]);
	});
});
