import { renderEmail } from '@zeyolabs/kit/utils/email';
import { describe, expect, it } from 'vitest';

import { customerOrderEmail, type OrderEmailData, shopOrderEmail } from './order';

const order: OrderEmailData = {
	address: {
		city: 'London',
		country: 'GB',
		line1: '1 Test Street',
		name: 'Sam Smith',
		postal_code: 'SW1A 1AA',
	},
	email: 'sam@example.com',
	items: [{ name: 'Espresso mini cup white', quantity: 2, unitPricePence: 1800 }],
	number: 'PL-ABC123',
	phone: '07700 900123',
	shippingPence: 450,
	subtotalPence: 3600,
	totalPence: 4050,
};

describe('customerOrderEmail', () => {
	const params = customerOrderEmail(order);

	it('greets by first name and shows the total', () => {
		expect(params.heading).toBe('Thank you, Sam');
		expect(params.intro[0]).toContain('£40.50');
	});

	it('lists items with quantity and line total, then subtotal, delivery and total', () => {
		const html = renderEmail(params);
		expect(html).toContain('Espresso mini cup white');
		expect(html).toContain('2 × £18.00');
		expect(html).toContain('£36.00');
		expect(html).toContain('Delivery');
		expect(html).toContain('£4.50');
		expect(html).toContain('£40.50');
	});

	it('shows the address with the country spelled out', () => {
		const html = renderEmail(params);
		expect(html).toContain('SW1A 1AA');
		expect(html).toContain('United Kingdom');
	});

	it('says free delivery when there is no charge', () => {
		const html = renderEmail(customerOrderEmail({ ...order, shippingPence: 0 }));
		expect(html).toContain('Free');
	});
});

describe('shopOrderEmail', () => {
	it('names the customer, email and phone', () => {
		const params = shopOrderEmail(order);
		expect(params.heading).toBe('PL-ABC123: £40.50');
		expect(params.intro[0]).toContain('sam@example.com');
		expect(params.intro[0]).toContain('07700 900123');
	});
});
