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
