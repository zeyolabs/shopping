import { getRequestEvent } from '$app/server';
import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error404 } from '@zeyolabs/kit/utils/errors';
import { z } from 'zod';

import { BundleChoiceSchema } from '../bundles.schema';
import { shopping } from '../config';
import { readBasket, writeBasket } from '../server/basket';
import { BundleService } from '../server/bundles';
import { getBasket } from './basket.remote';

export const getBundle = Remote.Query(z.string().min(1).max(200), async (slug) => {
	const bundle = await new BundleService(shopping().db()).page(slug);
	if (!bundle) throw Error404('Bundle not found');
	return bundle;
});

/** Adds the chosen products to the basket as ordinary lines, after checking the choice. */
export const addBundleToBasket = Remote.Cmd(BundleChoiceSchema, async ({ bundleId, choices }) => {
	const lines = await new BundleService(shopping().db()).expand(bundleId, choices);
	const { cookies } = getRequestEvent();
	const basket = readBasket(cookies);
	for (const [productId, quantity] of lines) {
		basket[productId] = Math.min((basket[productId] ?? 0) + quantity, 99);
	}
	writeBasket(cookies, basket);
	await getBasket().refresh();
});
