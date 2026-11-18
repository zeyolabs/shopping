import { getRequestEvent } from '$app/server';
import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error404 } from '@zeyolabs/kit/utils/errors';

import { getBasket } from '../basket/client.remote';
import { BasketCookies } from '../basket/cookies.server';
import { BasketBundles, BasketCookie } from '../basket/library';
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

/**
 * Checks the choice, then adds it to the basket: a kit or discounted bundle as one line (kept with
 * its choices, re-priced on every read), a plain bundle as ordinary product lines.
 */
export const addBundleToBasket = Remote.Cmd(BundleChoiceSchema, async ({ bundleId, choices }) => {
	const service = new BundleService(shopping().db());
	const resolved = await service.resolve(bundleId, choices);
	const { cookies } = getRequestEvent();
	if (resolved.grouped) {
		BasketCookies.writeBundles(
			cookies,
			BasketBundles.add(BasketCookies.readBundles(cookies), { bundleId, choices })
		);
	} else {
		let basket = BasketCookies.read(cookies);
		for (const part of resolved.parts) {
			basket = BasketCookie.add(basket, part.productId, part.quantity);
		}
		BasketCookies.write(cookies, basket);
	}
	await getBasket().refresh();
});
