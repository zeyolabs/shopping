import { describe, expect, it } from 'vitest';

import { Stock } from './library';

describe('Stock.sellable', () => {
	it('is the stock for single units', () => {
		expect(Stock.sellable(7)).toBe(7);
		expect(Stock.sellable(7, 1)).toBe(7);
	});

	it('counts whole packs only', () => {
		expect(Stock.sellable(30, 10)).toBe(3);
		expect(Stock.sellable(9, 10)).toBe(0);
	});

	it('treats bad input as empty or single', () => {
		expect(Stock.sellable(-5, 10)).toBe(0);
		expect(Stock.sellable(5, 0)).toBe(5);
	});
});

describe('Stock.groupTotal', () => {
	it('sums the sellable counts of the variations', () => {
		expect(
			Stock.groupTotal([
				{ packSize: 1, stock: 4 },
				{ packSize: 1, stock: 0 },
				{ packSize: 10, stock: 25 },
			])
		).toBe(6);
	});

	it('is 0 for no variations', () => {
		expect(Stock.groupTotal([])).toBe(0);
	});
});

describe('Stock.combinedAvailable', () => {
	it('is the fewest complete sets the components allow', () => {
		expect(
			Stock.combinedAvailable([
				{ packSize: 1, quantity: 1, stock: 5 },
				{ packSize: 1, quantity: 2, stock: 7 },
			])
		).toBe(3);
	});

	it('uses whole packs of a component', () => {
		expect(Stock.combinedAvailable([{ packSize: 10, quantity: 1, stock: 35 }])).toBe(3);
	});

	it('is 0 when any component is out, or when there are none', () => {
		expect(
			Stock.combinedAvailable([
				{ packSize: 1, quantity: 1, stock: 5 },
				{ packSize: 1, quantity: 1, stock: 0 },
			])
		).toBe(0);
		expect(Stock.combinedAvailable([])).toBe(0);
	});
});

describe('Stock.badge', () => {
	it('says out of stock at 0', () => {
		expect(Stock.badge(0, 3)).toEqual({ kind: 'out' });
	});

	it('says only N left at or below the threshold', () => {
		expect(Stock.badge(3, 3)).toEqual({ count: 3, kind: 'low' });
		expect(Stock.badge(1, 3)).toEqual({ count: 1, kind: 'low' });
	});

	it('is in stock above the threshold or with no threshold', () => {
		expect(Stock.badge(4, 3)).toEqual({ kind: 'in' });
		expect(Stock.badge(1, null)).toEqual({ kind: 'in' });
		expect(Stock.badge(1, undefined)).toEqual({ kind: 'in' });
	});
});
