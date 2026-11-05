import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error404 } from '@zeyolabs/kit/utils/errors';
import { z } from 'zod';

import { shopping } from '../config';
import { findOrderBySession, findOrderForCustomer } from '../server/orders';

/**
 * The order behind a Stripe Checkout Session, for the thank-you page. `null` while the webhook
 * has not landed yet, so the page can say "still processing" and ask again.
 */
export const getCheckoutOrder = Remote.Query(z.string().min(1).max(255), async (sessionId) => {
	const order = await findOrderBySession(shopping().db(), sessionId);
	if (!order) return null;
	return {
		number: order.number,
		orderPath: order.accessToken ? `/order/${order.number}/${order.accessToken}` : null,
	};
});

/**
 * The private order page, for whoever holds the link. Same 404 for "no such order" and "wrong
 * token", so the number cannot be probed. Cache and robots headers are set in hooks.server.ts.
 */
export const getOrderPage = Remote.Query(
	z.object({ number: z.string().min(1).max(40), token: z.string().min(1).max(200) }),
	async ({ number, token }) => {
		const found = await findOrderForCustomer(shopping().db(), number, token);
		if (!found?.address) throw Error404('Order not found');
		const { address, items, order } = found;
		return {
			address: {
				city: address.city,
				country: address.country,
				line1: address.line1,
				line2: address.line2,
				name: address.name,
				postcode: address.postcode,
			},
			items: items.map((item) => ({
				name: item.name,
				quantity: item.quantity,
				unitPricePence: item.unitPricePence,
			})),
			order: {
				createdAt: order.createdAt,
				discountPence: order.discountPence,
				number: order.number,
				paidAt: order.paidAt,
				shippedAt: order.shippedAt,
				shippingPence: order.shippingPence,
				status: order.status,
				subtotalPence: order.subtotalPence,
				totalPence: order.totalPence,
				trackingNumber: order.trackingNumber,
			},
		};
	}
);
