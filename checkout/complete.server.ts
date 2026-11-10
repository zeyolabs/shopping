import type { RequestHandler } from '@sveltejs/kit';

import { redirect } from '@sveltejs/kit';
import { logger } from '@zeyolabs/kit/server/logger';

import { BasketCookies } from '../basket/cookies.server';
import { shopping } from '../config';
import { OrderManager } from '../orders/manager.server';
import { OrderService } from '../orders/service.server';

/**
 * Stripe sends the customer here after paying. Fulfils the order in case the webhook has not
 * landed yet (fulfilment is idempotent), empties the basket once the order exists, then shows the
 * thank-you page.
 */
export const GET: RequestHandler = async ({ cookies, url }) => {
	const sessionId = url.searchParams.get('session_id') ?? '';
	if (!/^cs_\w{1,250}$/.test(sessionId)) redirect(303, '/basket');

	try {
		await OrderManager.fulfil(sessionId);
	} catch (err) {
		// The webhook retries fulfilment, so the customer still gets the thank-you page.
		logger.error(err, { op: 'checkoutComplete' });
	}
	const service = new OrderService(shopping().db());
	if (await service.bySession(sessionId)) BasketCookies.clear(cookies);

	redirect(303, `/checkout/success?session_id=${sessionId}`);
};
