import { getRequestEvent } from '$app/server';
import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error400 } from '@zeyolabs/kit/utils/errors';
import { z } from 'zod';

import { shopping } from '../config';
import { ShippingService } from '../shipping/service.server';
import { BasketCookies } from './cookies.server';
import { BasketCookie } from './library';
import { BasketService } from './service.server';

const ProductId = z.number().int().positive();

export const getBasket = Remote.Query(async () => {
	const { cookies } = getRequestEvent();
	const { db, shipping } = shopping();
	const service = new BasketService(db());
	return service.summarise(
		BasketCookies.read(cookies),
		BasketCookies.readShipTo(cookies, shipping.defaultCountry),
		shipping
	);
});

export const addToBasket = Remote.Cmd(
	z.object({ productId: ProductId, quantity: z.number().int().min(1).max(99).default(1) }),
	async ({ productId, quantity }) => {
		const { cookies } = getRequestEvent();
		BasketCookies.write(
			cookies,
			BasketCookie.add(BasketCookies.read(cookies), productId, quantity)
		);
		await getBasket().refresh();
	}
);

/** Quantity 0 removes the line. */
export const setBasketQuantity = Remote.Cmd(
	z.object({ productId: ProductId, quantity: z.number().int().min(0).max(99) }),
	async ({ productId, quantity }) => {
		const { cookies } = getRequestEvent();
		BasketCookies.write(
			cookies,
			BasketCookie.set(BasketCookies.read(cookies), productId, quantity)
		);
		await getBasket().refresh();
	}
);

export const getShippableCountries = Remote.Query(async () => {
	const service = new ShippingService(shopping().db());
	return service.countries();
});

export const setShipTo = Remote.Cmd(
	z.object({ country: z.string().regex(/^[A-Z]{2}$/) }),
	async ({ country }) => {
		const { cookies } = getRequestEvent();
		const service = new ShippingService(shopping().db());
		const allowed = await service.countries();
		if (!allowed.some((c) => c.code === country)) throw Error400('We do not ship to that country.');
		BasketCookies.writeShipTo(cookies, country);
		await getBasket().refresh();
	}
);
