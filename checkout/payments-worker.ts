import { WorkerRouter } from '@zeyolabs/kit/cloudflare/workers';

import { StripeWebhook } from './webhook';

/**
 * A Worker that only takes Stripe's webhook (`POST /stripe/webhook`), on a host of its own, so
 * the URL Stripe calls never moves when the shop's domain or deploys do. The app's Worker imports
 * its shopping config first (which registers it) and passes the secret names it reads.
 */
export const PaymentsWorker = {
	create(secretNames: ReadonlySet<string>): ExportedHandler<{ SENTRY_DSN: string }> {
		return WorkerRouter.withSentry(secretNames)
			.post('/stripe/webhook', ({ req }) => StripeWebhook.handle(req))
			.build();
	},
};
