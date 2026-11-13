import type { RequestHandler } from '@sveltejs/kit';

import { error } from '@sveltejs/kit';
import { logger } from '@zeyolabs/kit/server/logger';

import { ShopClients } from '../clients/shop.server';
import { StripeClient } from '../clients/stripe';
import { secret } from '../config';
import { OrderManager } from '../orders/manager.server';

/** Stripe calls this after payment. Unsigned or mis-signed requests are rejected before any work. */
export const POST: RequestHandler = async ({ request }) => {
	const signature = request.headers.get('stripe-signature');
	if (!signature) error(400, 'Missing signature');

	let event;
	try {
		event = await ShopClients.stripe().webhooks.constructEventAsync(
			await request.text(),
			signature,
			secret('stripeWebhookSecret'),
			undefined,
			StripeClient.webhookCrypto
		);
	} catch {
		error(400, 'Invalid signature');
	}

	if (
		event.type === 'checkout.session.completed' ||
		event.type === 'checkout.session.async_payment_succeeded'
	) {
		try {
			await OrderManager.fulfil(event.data.object.id);
		} catch (err) {
			logger.error(err, { eventId: event.id, op: 'stripeWebhook' });
			// 500 makes Stripe retry; fulfilment is idempotent.
			error(500, 'Fulfilment failed');
		}
	}
	return Response.json({ received: true });
};
