import { getRequestEvent } from '$app/server';
import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error404 } from '@zeyolabs/kit/utils/errors';

import { getBasket } from '../basket/client.remote';
import { BasketCookies } from '../basket/cookies.server';
import { BasketCookie } from '../basket/library';
import { shopping } from '../config';
import { ShopSchema } from '../utils/schemas';
import { BundleChoiceSchema } from './schema';
import { BundleService } from './service.server';

export const getBundle = Remote.Query(ShopSchema.SlugParam, async (slug) => {
	const service = new BundleService(shopping().db());
	const bundle = await service.page(slug);
	if (!bundle) throw Error404('Bundle not found');
	return bundle;
});

/** Adds the chosen products to the basket as ordinary lines, after checking the choice. */
export const addBundleToBasket = Remote.Cmd(BundleChoiceSchema, async ({ bundleId, choices }) => {
	const service = new BundleService(shopping().db());
	const lines = await service.expand(bundleId, choices);
	const { cookies } = getRequestEvent();
	let basket = BasketCookies.read(cookies);
	for (const [productId, quantity] of lines) basket = BasketCookie.add(basket, productId, quantity);
	BasketCookies.write(cookies, basket);
	await getBasket().refresh();
});
