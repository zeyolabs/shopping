import type Stripe from 'stripe';

import { getRequestEvent } from '$app/server';
import { AuthHandle } from '@zeyolabs/kit/auth/sessions/handle';
import { Error400 } from '@zeyolabs/kit/utils/errors';

import { BasketCookies } from '../basket/cookies.server';
import { BasketService, type BasketSummary } from '../basket/service.server';
import { ShopClients } from '../clients/shop.server';
import { shopping } from '../config';
import { CustomerService } from '../customers/service.server';
import { Images } from '../utils/images';

type ShippableSummary = BasketSummary & { shipping: NonNullable<BasketSummary['shipping']> };

/** Starting a Stripe Checkout. The app wraps `start` in its own remote function and rate-limits it. */
export const CheckoutManager = {
	/**
	 * Prices the basket from the database and returns the Stripe Checkout URL to redirect to. The
	 * order itself is only created from the webhook once paid. A signed-in customer (the app's kit
	 * `AuthHandle` in front) is passed to Stripe as a Customer, so their saved details are filled
	 * in; the email is read from their session here, never taken from the caller.
	 */
	async start(): Promise<{ url: string }> {
		const event = getRequestEvent();
		const { cookies, url } = event;
		const config = shopping();
		const db = config.db();
		const basket = new BasketService(db);
		const summary = await basket.summarise(
			BasketCookies.read(cookies),
			BasketCookies.readShipTo(cookies, config.shipping.defaultCountry),
			config.shipping
		);

		if (summary.lines.length === 0) throw Error400('Your basket is empty.');
		const unavailable = summary.lines.find((line) => line.available < 1);
		if (unavailable)
			throw Error400(`${unavailable.name} is out of stock. Please remove it to continue.`);
		const short = summary.lines.find((line) => line.available < line.quantity);
		if (short) {
			throw Error400(
				`Only ${short.available} of ${short.name} available. Please update your basket.`
			);
		}
		if (!summary.shipping) {
			throw Error400(
				'We cannot ship this order to the selected country. Please choose another or contact us.'
			);
		}

		const client = ShopClients.stripe();
		const customers = new CustomerService(db);
		const email = AuthHandle.locals(event).user?.email;
		const customerId = email ? await customers.stripeCustomerId(client, email) : undefined;
		const session = await client.checkout.sessions.create(
			sessionParams({ ...summary, shipping: summary.shipping }, url.origin, customerId)
		);
		if (!session.url) throw new Error('Stripe returned a Checkout Session without a url');
		return { url: session.url };
	},
};

/**
 * The hosted Checkout for a priced basket. The shipping fee is a Stripe shipping rate so the
 * customer sees it before paying. Promotion codes and invoices follow the shop's `checkout` config.
 */
function sessionParams(
	summary: ShippableSummary,
	origin: string,
	customerId: string | undefined
): Stripe.Checkout.SessionCreateParams {
	const { checkout = {}, imageBaseUrl } = shopping();
	return {
		allow_promotion_codes: checkout.promotionCodes || undefined,
		cancel_url: `${origin}/basket`,
		customer: customerId,
		customer_update: customerId ? { address: 'auto', name: 'auto', shipping: 'auto' } : undefined,
		invoice_creation: checkout.invoices
			? {
					enabled: true,
					invoice_data: {
						custom_fields: checkout.invoices.customFields?.slice(0, 4),
						footer: checkout.invoices.footer,
						metadata: { source: 'checkout' },
					},
				}
			: undefined,
		line_items: summary.lines.map((line) => ({
			price_data: {
				currency: 'gbp',
				product_data: {
					images: line.cover
						? [new URL(Images.url(imageBaseUrl, line.cover.src), origin).href]
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
	};
}
