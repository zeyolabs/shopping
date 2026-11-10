import type { RequestHandler } from '@sveltejs/kit';

import { error, redirect } from '@sveltejs/kit';

import { OrderNumber } from '../admin/orders.schema';
import { findOrder } from '../server/admin-orders';
import { invoicePdfUrl } from '../server/orders';

/** `/orders/<number>/invoice` in the admin: the order's Stripe invoice PDF. Behind the admin's auth. */
export const GET: RequestHandler<{ number: string }> = async ({ params }) => {
	const number = OrderNumber.safeParse(params.number);
	const order = number.success ? await findOrder(number.data) : undefined;
	const url = await invoicePdfUrl(order?.stripeInvoiceId ?? null);
	if (!url) error(404, 'Invoice not found');
	redirect(303, url);
};
