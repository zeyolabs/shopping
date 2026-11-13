import Stripe from 'stripe';

/** Stripe on Workers. The secret key comes in; nothing is read ambiently. */
export const StripeClient = {
	create(secretKey: string): Stripe {
		return new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
	},

	/** Subtle-crypto verifier, required for webhooks on Workers (no Node crypto). */
	webhookCrypto: Stripe.createSubtleCryptoProvider(),
};
