import { getRequestEvent } from '$app/server';
import { Error400 } from '@zeyolabs/kit/utils/errors';

import { shopping } from '../config';
import { readBasket, readShipTo, summariseBasket } from './basket';
import { CustomerService } from './customers';
import { createCheckoutSession, getStripe } from './stripe';

/**
 * Prices the basket from the database and returns the Stripe Checkout URL to redirect to. The app
 * wraps this in its own remote function, where it rate-limits the call.
 */
export async function createCheckout(
	options: {
		/** The signed-in customer's email: Checkout then fills in their saved details. */
		email?: null | string;
	} = {}
): Promise<{ url: string }> {
	const { cookies, url } = getRequestEvent();
	const summary = await summariseBasket(shopping().db(), readBasket(cookies), readShipTo(cookies));

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

	const stripe = await getStripe();
	const customerId = options.email
		? await new CustomerService(shopping().db()).stripeCustomerId(stripe, options.email)
		: undefined;
	return {
		url: await createCheckoutSession(
			stripe,
			{ ...summary, shipping: summary.shipping },
			url.origin,
			customerId
		),
	};
}
