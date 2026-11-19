import { logger } from '@zeyolabs/kit/server/logger';

import { ShopClients } from '../clients/shop.server';
import { StripeClient } from '../clients/stripe';
import { secret } from '../config';
import { OrderManager } from '../orders/manager.server';

const FULFIL_ON = new Set([
	'checkout.session.async_payment_succeeded',
	'checkout.session.completed',
]);

/**
 * Stripe's webhook, independent of any framework: the shop's SvelteKit route and the standalone
 * payments Worker both answer with it. Runs inside `runWithContext`.
 */
export const StripeWebhook = {
	/**
	 * Unsigned or mis-signed requests get a 400 before any work. A paid Checkout session is
	 * fulfilled; a failed fulfilment answers 500 so Stripe retries (fulfilment is idempotent).
	 * Every other event is acknowledged and ignored.
	 */
	async handle(request: Request): Promise<Response> {
		const signature = request.headers.get('stripe-signature');
		if (!signature) return new Response('Missing signature', { status: 400 });

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
			return new Response('Invalid signature', { status: 400 });
		}

		if (FULFIL_ON.has(event.type)) {
			const session = event.data.object as { id: string };
			try {
				await OrderManager.fulfil(session.id);
			} catch (err) {
				logger.error(err, { eventId: event.id, op: 'stripeWebhook' });
				return new Response('Fulfilment failed', { status: 500 });
			}
		}
		return Response.json({ received: true });
	},
};
