import type { RequestHandler } from '@sveltejs/kit';

import { error, redirect } from '@sveltejs/kit';

import { shopping } from '../config';
import { OrderManager } from './manager.server';
import { OrderService } from './service.server';

/**
 * `/order/<number>/<token>/invoice`: sends the customer to their invoice PDF on Stripe. The token
 * is the access control, as on the order page; a wrong token and a missing invoice are the same 404.
 */
export const GET: RequestHandler<{ number: string; token: string }> = async ({ params }) => {
	const service = new OrderService(shopping().db());
	const found = await service.forCustomer(params.number, params.token);
	const url = await OrderManager.invoiceUrl(found?.order.stripeInvoiceId ?? null);
	if (!url) error(404, 'Invoice not found');
	redirect(303, url);
};
