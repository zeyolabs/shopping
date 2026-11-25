import { describe, expect, it } from 'vitest';

import { Orders } from './library';

describe('Orders.chosenService', () => {
	it('reads the service from the shipping rate the customer chose', () => {
		const session = {
			metadata: {},
			shipping_cost: { shipping_rate: { metadata: { service: 'royal-mail-1st' } } },
		};
		expect(Orders.chosenService(session)).toBe('royal-mail-1st');
	});

	it('falls back to the session metadata of sessions started before the choice', () => {
		const session = {
			metadata: { shippingService: 'royal-mail-2nd' },
			shipping_cost: { shipping_rate: 'shr_1' },
		};
		expect(Orders.chosenService(session)).toBe('royal-mail-2nd');
		expect(Orders.chosenService({ metadata: null, shipping_cost: null })).toBeNull();
	});
});

describe('Orders.tidy', () => {
	const part = (name: string, productId: number, quantity: number, singleUnits = true) => ({
		name,
		productId,
		quantity,
		singleUnits,
	});

	it('merges a repeated product, adding the quantities at one price', () => {
		const { items } = Orders.tidy({
			bundles: [],
			items: [
				{ name: 'Tea', productId: 1, quantity: 1, unitPricePence: 500 },
				{ name: 'Tea', productId: 1, quantity: 2, unitPricePence: 500 },
			],
		});
		expect(items).toEqual([{ name: 'Tea', productId: 1, quantity: 3, unitPricePence: 500 }]);
	});

	it('keeps the total when merged rows were bought at different prices', () => {
		const { items } = Orders.tidy({
			bundles: [],
			items: [
				{ name: 'Tea', productId: 1, quantity: 2, unitPricePence: 500 },
				{ name: 'Tea', productId: 1, quantity: 1, unitPricePence: 400 },
			],
		});
		expect(items).toEqual([{ name: 'Tea', productId: 1, quantity: 1, unitPricePence: 1400 }]);
	});

	it('merges one bundle built twice and adds its parts up by product and unit type', () => {
		const { bundles } = Orders.tidy({
			bundles: [
				{
					bundleId: 3,
					name: 'Tester',
					parts: [part('b', 2, 1), part('A', 1, 1), part('A', 1, 1, false)],
					quantity: 1,
					unitPricePence: 1950,
				},
				{
					bundleId: 3,
					name: 'Tester',
					parts: [part('b', 2, 2), part('A', 1, 1)],
					quantity: 1,
					unitPricePence: 1950,
				},
			],
			items: [],
		});
		expect(bundles).toHaveLength(1);
		expect(bundles[0]).toMatchObject({ quantity: 2, unitPricePence: 1950 });
		expect(bundles[0].parts.map((p) => [p.name, p.singleUnits, p.quantity])).toEqual([
			['A', true, 2],
			['A', false, 1],
			['b', true, 3],
		]);
	});

	it('sorts lines by name ignoring case', () => {
		const { items } = Orders.tidy({
			bundles: [],
			items: [
				{ name: 'banana', productId: 2, quantity: 1, unitPricePence: 1 },
				{ name: 'Apple', productId: 1, quantity: 1, unitPricePence: 1 },
			],
		});
		expect(items.map((i) => i.name)).toEqual(['Apple', 'banana']);
	});
});
