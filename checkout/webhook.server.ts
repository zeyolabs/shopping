import type { RequestHandler } from '@sveltejs/kit';

import { StripeWebhook } from './webhook';

/** Stripe's webhook as a SvelteKit route: `export { POST } from` this in the app. */
export const POST: RequestHandler = ({ request }) => StripeWebhook.handle(request);
