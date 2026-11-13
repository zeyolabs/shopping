import type { RequestHandler } from '@sveltejs/kit';

import { error, redirect } from '@sveltejs/kit';

import { FulfilmentManager } from './manager.server';
import { OrderNumber } from './schema';

/** `/orders/<number>/invoice` in the admin: the order's Stripe invoice PDF. Behind the admin's auth. */
export const GET: RequestHandler<{ number: string }> = async ({ params }) => {
	const number = OrderNumber.safeParse(params.number);
	const url = number.success ? await FulfilmentManager.invoiceUrl(number.data) : undefined;
	if (!url) error(404, 'Invoice not found');
	redirect(303, url);
};
