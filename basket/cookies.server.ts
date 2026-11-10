import type { Cookies } from '@sveltejs/kit';

import { type Basket, BasketCookie } from './library';

const COOKIE = 'basket';
const SHIP_TO_COOKIE = 'ship_to';
const OPTIONS = {
	httpOnly: true,
	maxAge: 60 * 60 * 24 * 30,
	path: '/',
	sameSite: 'lax',
	secure: true,
} as const;

/** The basket and ship-to country, kept in cookies for 30 days. For the edge (remote functions, handlers). */
export const BasketCookies = {
	clear(cookies: Cookies): void {
		cookies.delete(COOKIE, { path: '/' });
	},

	read(cookies: Cookies): Basket {
		return BasketCookie.parse(cookies.get(COOKIE));
	},

	/** The chosen country, or `fallback` (the shop's default) when unset or invalid. */
	readShipTo(cookies: Cookies, fallback: string): string {
		const value = cookies.get(SHIP_TO_COOKIE);
		return value && /^[A-Z]{2}$/.test(value) ? value : fallback;
	},

	write(cookies: Cookies, basket: Basket): void {
		cookies.set(COOKIE, JSON.stringify(basket), OPTIONS);
	},

	writeShipTo(cookies: Cookies, country: string): void {
		cookies.set(SHIP_TO_COOKIE, country, OPTIONS);
	},
};
