import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Config from '../config';

const constructEventAsync = vi.fn();
const fulfil = vi.fn();

vi.mock('../clients/shop.server', () => ({
	ShopClients: { stripe: () => ({ webhooks: { constructEventAsync } }) },
}));
vi.mock('../config', async (original) => ({
	...(await original<typeof Config>()),
	secret: () => 'whsec_test',
}));
vi.mock('../orders/manager.server', () => ({ OrderManager: { fulfil } }));
vi.mock('@zeyolabs/kit/server/logger', () => ({ logger: { error: vi.fn() } }));

const { StripeWebhook } = await import('./webhook');

const signed = () =>
	new Request('https://payments.test.example/stripe/webhook', {
		body: '{}',
		headers: { 'stripe-signature': 't=1,v1=abc' },
		method: 'POST',
	});

const event = (type: string) => ({ data: { object: { id: 'cs_1' } }, id: 'evt_1', type });

describe('StripeWebhook.handle', () => {
	beforeEach(() => {
		constructEventAsync.mockReset();
		fulfil.mockReset();
	});

	it('rejects a request without a signature', async () => {
		const response = await StripeWebhook.handle(
			new Request('https://payments.test.example/stripe/webhook', { body: '{}', method: 'POST' })
		);
		expect(response.status).toBe(400);
		expect(constructEventAsync).not.toHaveBeenCalled();
	});

	it('rejects a bad signature before any work', async () => {
		constructEventAsync.mockRejectedValue(new Error('bad'));
		expect((await StripeWebhook.handle(signed())).status).toBe(400);
		expect(fulfil).not.toHaveBeenCalled();
	});

	it('fulfils a paid Checkout session', async () => {
		constructEventAsync.mockResolvedValue(event('checkout.session.completed'));
		const response = await StripeWebhook.handle(signed());
		expect(response.status).toBe(200);
		expect(fulfil).toHaveBeenCalledWith('cs_1');
	});

	it('answers 500 when fulfilment fails, so Stripe retries', async () => {
		constructEventAsync.mockResolvedValue(event('checkout.session.async_payment_succeeded'));
		fulfil.mockRejectedValue(new Error('db down'));
		expect((await StripeWebhook.handle(signed())).status).toBe(500);
	});

	it('acknowledges events it does not handle', async () => {
		constructEventAsync.mockResolvedValue(event('charge.refunded'));
		expect((await StripeWebhook.handle(signed())).status).toBe(200);
		expect(fulfil).not.toHaveBeenCalled();
	});
});
