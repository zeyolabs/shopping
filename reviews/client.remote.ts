import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error404 } from '@zeyolabs/kit/utils/errors';
import { FormResult } from '@zeyolabs/kit/utils/form';
import { z } from 'zod';

import { shopping } from '../config';
import { OrderService } from '../orders/service.server';
import { ReviewSchema } from './schema';
import { ReviewService } from './service.server';

const OrderLink = z.object({
	number: z.string().min(1).max(40),
	token: z.string().min(1).max(200),
});

async function orderFor(number: string, token: string) {
	const orders = new OrderService(shopping().db());
	const found = await orders.forCustomer(number, token);
	if (!found) throw Error404('Order not found');
	return found.order;
}

/** The order page's "review your items" list: each product and the review already written, if any. */
export const getOrderReviews = Remote.Query(OrderLink, async ({ number, token }) => {
	const order = await orderFor(number, token);
	const reviewable = order.status === 'paid' || order.status === 'shipped';
	const service = new ReviewService(shopping().db());
	return {
		items: reviewable ? await service.forOrder(order.id) : [],
	};
});

/** A review from the order page. It shows on the product page once staff approve it. */
export const reviewForm = Remote.Form(ReviewSchema, async ({ number, token, ...input }) => {
	const order = await orderFor(number, token);
	const service = new ReviewService(shopping().db());
	const saved = await service.submit(order.id, input);
	await getOrderReviews({ number, token }).refresh();
	return saved
		? FormResult.ok('Thank you. Your review will appear once we have checked it.')
		: FormResult.warn('This item has already been reviewed from this order.');
});
