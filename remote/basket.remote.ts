import { getRequestEvent } from '$app/server';
import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error400 } from '@zeyolabs/kit/utils/errors';
import { z } from 'zod';

import { shopping } from '../config';
import {
	readBasket,
	readShipTo,
	summariseBasket,
	writeBasket,
	writeShipTo,
} from '../server/basket';
import { listShippableCountries } from '../server/shipping';

const ProductId = z.number().int().positive();

function context() {
	const { cookies } = getRequestEvent();
	return { cookies, db: shopping().db() };
}

export const getBasket = Remote.Query(async () => {
	const { cookies, db } = context();
	return summariseBasket(db, readBasket(cookies), readShipTo(cookies));
});

export const addToBasket = Remote.Cmd(
	z.object({ productId: ProductId, quantity: z.number().int().min(1).max(99).default(1) }),
	async ({ productId, quantity }) => {
		const { cookies } = context();
		const basket = readBasket(cookies);
		basket[productId] = Math.min((basket[productId] ?? 0) + quantity, 99);
		writeBasket(cookies, basket);
		await getBasket().refresh();
	}
);

/** Quantity 0 removes the line. */
export const setBasketQuantity = Remote.Cmd(
	z.object({ productId: ProductId, quantity: z.number().int().min(0).max(99) }),
	async ({ productId, quantity }) => {
		const { cookies } = context();
		const basket = readBasket(cookies);
		if (quantity === 0) delete basket[productId];
		else basket[productId] = quantity;
		writeBasket(cookies, basket);
		await getBasket().refresh();
	}
);

export const getShippableCountries = Remote.Query(async () => listShippableCountries(context().db));

export const setShipTo = Remote.Cmd(
	z.object({ country: z.string().regex(/^[A-Z]{2}$/) }),
	async ({ country }) => {
		const { cookies, db } = context();
		const allowed = await listShippableCountries(db);
		if (!allowed.some((c) => c.code === country)) throw Error400('We do not ship to that country.');
		writeShipTo(cookies, country);
		await getBasket().refresh();
	}
);
