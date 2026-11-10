import { getRequestEvent } from '$app/server';
import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error400 } from '@zeyolabs/kit/utils/errors';
import { FormResult } from '@zeyolabs/kit/utils/form';
import { z } from 'zod';

import { shopping } from '../config';
import { ShippingService } from '../shipping/service.server';
import { BasketCookies } from './cookies.server';
import { BasketCookie } from './library';
import { AddToBasketSchema, BasketQuantitySchema } from './schema';
import { BasketService } from './service.server';

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

export const addToBasketForm = Remote.Form(AddToBasketSchema, async ({ productId, quantity }) => {
	const { cookies } = getRequestEvent();
	BasketCookies.write(cookies, BasketCookie.add(BasketCookies.read(cookies), productId, quantity));
	await getBasket().refresh();
	return FormResult.ok('Added to your basket');
});

/** The basket's − and + buttons. Quantity 0 removes the line. */
export const basketQuantityForm = Remote.Form(
	BasketQuantitySchema,
	async ({ productId, quantity }) => {
		const { cookies } = getRequestEvent();
		BasketCookies.write(
			cookies,
			BasketCookie.set(BasketCookies.read(cookies), productId, quantity)
		);
		await getBasket().refresh();
		return FormResult.ok();
	}
);

export const getShippableCountries = Remote.Query(async () => {
	const service = new ShippingService(shopping().db());
	return service.countries();
});

/** The country picker changes it as soon as a country is chosen, so this stays a command. */
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
