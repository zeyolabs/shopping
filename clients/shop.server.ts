import type Stripe from 'stripe';

import { secret } from '../config';
import { RoyalMailClient } from './royalmail';
import { StripeClient } from './stripe';

/**
 * The shop's clients, built with its own secrets. For managers and handlers (the edge), never
 * services. Kept out of `config.ts` so code that only needs the config (the back-in-stock worker)
 * does not bundle the Stripe SDK.
 */
export const ShopClients = {
	royalMail(): RoyalMailClient {
		return new RoyalMailClient(secret('royalMailApiKey'));
	},

	stripe(): Stripe {
		return StripeClient.create(secret('stripeSecretKey'));
	},
};
