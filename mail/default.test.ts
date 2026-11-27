import { FakeMailClient } from '@zeyolabs/kit/email/testing';
import { describe, expect, it } from 'vitest';

import type { DispatchEmailData } from '../fulfilment/dispatch-email';
import type { OrderEmailData } from '../orders/email';

import { defaultShopMail } from './default';

const order: OrderEmailData = {
	address: { city: 'London', country: 'GB', line1: '1 Test Street', name: 'Sam Smith' },
	email: 'sam@example.com',
	items: [{ name: 'Espresso mini cup white', quantity: 2, unitPricePence: 1800 }],
	number: 'TS-ABC123',
	shippingPence: 450,
	subtotalPence: 3600,
	totalPence: 4050,
};

const dispatched: DispatchEmailData = {
	address: {
		city: 'London',
		country: 'GB',
		line1: '1 Test Street',
		name: 'Sam Smith',
		postcode: 'AB1 2CD',
	},
	email: 'sam@example.com',
	number: 'TS-ABC123',
	token: 'tok123',
};

function setup() {
	const client = new FakeMailClient();
	const mail = defaultShopMail({ mailer: () => client, notifyEmail: 'info@test.example' });
	return { client, mail };
}

describe('defaultShopMail', () => {
	it('sends the order confirmation to the customer from the shop', async () => {
		const { client, mail } = setup();
		await mail.orderConfirmed(order);
		expect(client.sent).toHaveLength(1);
		expect(client.sent[0]).toMatchObject({
			from: 'support@test.example',
			fromName: 'Test Shop',
			subject: 'Your Test Shop order TS-ABC123',
			to: 'sam@example.com',
		});
		expect(client.sent[0].replyTo).toBeUndefined();
	});

	it('tells the shop about a new order, with the customer as reply-to', async () => {
		const { client, mail } = setup();
		await mail.newOrderAlert(order);
		expect(client.sent[0]).toMatchObject({
			from: 'support@test.example',
			fromName: 'Test Shop Admin',
			replyTo: { email: 'sam@example.com' },
			subject: 'New order TS-ABC123 (£40.50)',
			to: 'info@test.example',
		});
	});

	it('sends the dispatch email to the customer', async () => {
		const { client, mail } = setup();
		await mail.orderDispatched(dispatched);
		expect(client.sent[0]).toMatchObject({
			from: 'support@test.example',
			fromName: 'Test Shop',
			subject: 'Your Test Shop order TS-ABC123 has been dispatched',
			to: 'sam@example.com',
		});
	});

	it('sends the back-in-stock email to the signup', async () => {
		const { client, mail } = setup();
		await mail.backInStock?.({
			email: 'sam@example.com',
			pricePence: 1250,
			productName: 'Jeju Green',
			slug: 'jeju-green',
		});
		expect(client.sent[0]).toMatchObject({
			from: 'support@test.example',
			fromName: 'Test Shop',
			subject: 'Jeju Green is back in stock',
			to: 'sam@example.com',
		});
	});

	it('lets a delivery failure through, so the caller can retry', async () => {
		const { client, mail } = setup();
		client.succeeds = false;
		await expect(mail.orderConfirmed(order)).rejects.toThrow('delivery failed');
	});
});
