import Stripe from 'stripe';

import type { BasketSummary } from './basket';

import { secret, shopping } from '../config';
import { productImageUrl } from '../images';

type ShippableSummary = BasketSummary & { shipping: NonNullable<BasketSummary['shipping']> };

export async function getStripe(): Promise<Stripe> {
	return new Stripe(secret('stripeSecretKey'), {
		httpClient: Stripe.createFetchHttpClient(),
	});
}

/** Subtle-crypto verifier, required for webhooks on Workers (no Node crypto). */
export const webhookCrypto = Stripe.createSubtleCryptoProvider();

/**
 * Starts a hosted Checkout for the priced basket. The shipping fee is a Stripe shipping rate so the
 * customer sees it before paying; the order itself is only created from the webhook once paid.
 */
export async function createCheckoutSession(
	stripe: Stripe,
	summary: ShippableSummary,
	origin: string
): Promise<string> {
	const session = await stripe.checkout.sessions.create({
		cancel_url: `${origin}/basket`,
		line_items: summary.lines.map((line) => ({
			price_data: {
				currency: 'gbp',
				product_data: {
					images: line.cover
						? [new URL(productImageUrl(shopping().imageBaseUrl, line.cover.src), origin).href]
						: undefined,
					metadata: { productId: String(line.id), sku: line.sku },
					name: line.name,
				},
				unit_amount: line.pricePence,
			},
			quantity: line.available,
		})),
		metadata: {
			country: summary.country,
			shippingService: summary.shipping.service,
			weightGrams: String(summary.weightGrams),
		},
		mode: 'payment',
		phone_number_collection: { enabled: true },
		shipping_address_collection: {
			allowed_countries: [
				summary.country as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry,
			],
		},
		shipping_options: [
			{
				shipping_rate_data: {
					display_name:
						summary.shippingPence === 0 ? `Free ${summary.shipping.name}` : summary.shipping.name,
					fixed_amount: { amount: summary.shippingPence, currency: 'gbp' },
					type: 'fixed_amount',
				},
			},
		],
		success_url: `${origin}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
	});
	if (!session.url) throw new Error('Stripe returned a Checkout Session without a url');
	return session.url;
}
