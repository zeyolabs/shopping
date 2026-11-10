import type { RequestHandler } from '@sveltejs/kit';

import { error, redirect } from '@sveltejs/kit';

import { shopping } from '../config';
import { findOrderForCustomer, invoicePdfUrl } from '../server/orders';

/**
 * `/order/<number>/<token>/invoice`: sends the customer to their invoice PDF on Stripe. The token
 * is the access control, as on the order page; a wrong token and a missing invoice are the same 404.
 */
export const GET: RequestHandler<{ number: string; token: string }> = async ({ params }) => {
	const found = await findOrderForCustomer(shopping().db(), params.number, params.token);
	const url = await invoicePdfUrl(found?.order.stripeInvoiceId ?? null);
	if (!url) error(404, 'Invoice not found');
	redirect(303, url);
};
