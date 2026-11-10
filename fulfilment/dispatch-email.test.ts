import { renderEmail, renderEmailText } from '@zeyolabs/kit/utils/email';
import { describe, expect, it } from 'vitest';

import { shopping } from '../config';
import { Orders } from '../orders/library';

const orderUrl = (n: string, t: string) => Orders.url(shopping().siteUrl, n, t);
const trackingUrl = Orders.trackingUrl;
import { DispatchEmail, type DispatchEmailData } from './dispatch-email';

const order: DispatchEmailData = {
	address: {
		city: 'London',
		country: 'GB',
		line1: '1 Test Street',
		line2: null,
		name: 'Sam Smith',
		postcode: 'AB1 2CD',
	},
	email: 'sam@example.com',
	number: 'PL-ABC234',
	token: 'tok123',
	trackingNumber: 'AB123456789GB',
};

describe('dispatchEmail', () => {
	it('links a tracked parcel to the Royal Mail tracker and the order page', () => {
		const params = DispatchEmail.build(order);
		expect(params.badge).toBe('Dispatched');
		expect(params.heading).toBe('Your order is on its way, Sam');
		expect(params.cta).toEqual({ href: trackingUrl('AB123456789GB'), label: 'Track your parcel' });
		expect(renderEmailText(params)).toContain(orderUrl('PL-ABC234', 'tok123'));
	});

	it('links an untracked parcel to the order page', () => {
		const params = DispatchEmail.build({ ...order, trackingNumber: null });
		expect(params.cta).toEqual({ href: orderUrl('PL-ABC234', 'tok123'), label: 'View your order' });
		expect(params.footnote).toContain('untracked');
	});

	it('escapes the customer name in the html', () => {
		const html = renderEmail(
			DispatchEmail.build({ ...order, address: { ...order.address, name: '<b>Sam</b>' } })
		);
		expect(html).not.toContain('<b>Sam</b>');
	});
});

describe('order links', () => {
	it('encodes tracking numbers', () => {
		expect(trackingUrl('A B/1')).toBe(
			'https://www.royalmail.com/track-your-item#/tracking-results/A%20B%2F1'
		);
	});
});
