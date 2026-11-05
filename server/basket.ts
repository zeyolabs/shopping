import type { Cookies } from '@sveltejs/kit';

import { and, asc, eq, inArray } from 'drizzle-orm';

import type { ShopDb } from '../db';

import { shopping } from '../config';
import { productImages, products } from '../db/schema';
import { quoteShipping, type ShippingQuote } from './shipping';

/** The basket lives in a cookie as `{ [productId]: quantity }`; prices always come from D1. */
const COOKIE = 'basket';
const SHIP_TO_COOKIE = 'ship_to';
const MAX_LINES = 30;

export type Basket = Record<number, number>;

export type BasketLine = {
	/** What the customer can actually buy right now: min(requested, stock, max per order). */
	available: number;
	cover: null | { alt: string; src: string };
	id: number;
	/** The most of this product one order can hold: min(stock, max per order). */
	limit: number;
	lineTotalPence: number;
	massGrams: number;
	name: string;
	pricePence: number;
	quantity: number;
	sku: string;
	slug: string;
	stock: number;
};

export type BasketSummary = {
	/** Total items in the basket, for the header badge. */
	count: number;
	country: string;
	/** True when `country` is the shop's home country, where the free-delivery offer applies. */
	domestic: boolean;
	/** UK orders at or above this subtotal ship free. */
	freeShippingFromPence: number;
	lines: BasketLine[];
	/** Null when nothing can ship to `country` for this basket (see `shippingError`). */
	shipping: null | ShippingQuote;
	shippingPence: number;
	subtotalPence: number;
	totalPence: number;
	weightGrams: number;
};

export function parseBasket(raw: string | undefined): Basket {
	if (!raw) return {};
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {};
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

	const basket: Basket = {};
	for (const [key, value] of Object.entries(parsed).slice(0, MAX_LINES)) {
		const id = Number(key);
		if (Number.isInteger(id) && id > 0 && Number.isInteger(value) && value > 0) {
			basket[id] = Math.min(value as number, 99);
		}
	}
	return basket;
}

export const readBasket = (cookies: Cookies): Basket => parseBasket(cookies.get(COOKIE));

export function writeBasket(cookies: Cookies, basket: Basket): void {
	cookies.set(COOKIE, JSON.stringify(basket), {
		httpOnly: true,
		maxAge: 60 * 60 * 24 * 30,
		path: '/',
		sameSite: 'lax',
		secure: true,
	});
}

export function clearBasket(cookies: Cookies): void {
	cookies.delete(COOKIE, { path: '/' });
}

export function readShipTo(cookies: Cookies): string {
	const value = cookies.get(SHIP_TO_COOKIE);
	return value && /^[A-Z]{2}$/.test(value) ? value : shopping().shipping.defaultCountry;
}

export function writeShipTo(cookies: Cookies, country: string): void {
	cookies.set(SHIP_TO_COOKIE, country, {
		httpOnly: true,
		maxAge: 60 * 60 * 24 * 30,
		path: '/',
		sameSite: 'lax',
		secure: true,
	});
}

function shippingOffer(country: string) {
	const { defaultCountry, freeUkFromPence } = shopping().shipping;
	return { domestic: country === defaultCountry, freeShippingFromPence: freeUkFromPence };
}

/** Prices the basket from current catalogue data. Inactive or deleted products drop out. */
export async function summariseBasket(
	db: ShopDb,
	basket: Basket,
	country: string
): Promise<BasketSummary> {
	const ids = Object.keys(basket).map(Number);
	if (ids.length === 0) {
		return {
			count: 0,
			country,
			...shippingOffer(country),
			lines: [],
			shipping: null,
			shippingPence: 0,
			subtotalPence: 0,
			totalPence: 0,
			weightGrams: 0,
		};
	}

	const rows = await db
		.select()
		.from(products)
		.where(and(inArray(products.id, ids), eq(products.active, true)))
		.orderBy(asc(products.name));
	const images = await db
		.select()
		.from(productImages)
		.where(
			inArray(
				productImages.productId,
				rows.map((p) => p.id)
			)
		)
		.orderBy(asc(productImages.position));
	const cover = new Map<number, (typeof images)[number]>();
	for (const image of images) if (!cover.has(image.productId)) cover.set(image.productId, image);

	const lines = rows.map((product): BasketLine => {
		const quantity = basket[product.id];
		const available = Math.max(0, Math.min(quantity, product.stock, product.maxPerOrder));
		const image = cover.get(product.id);
		return {
			available,
			cover: image ? { alt: image.alt, src: image.src } : null,
			id: product.id,
			limit: Math.max(0, Math.min(product.stock, product.maxPerOrder)),
			lineTotalPence: available * product.pricePence,
			massGrams: product.massGrams,
			name: product.name,
			pricePence: product.pricePence,
			quantity,
			sku: product.sku,
			slug: product.slug,
			stock: product.stock,
		};
	});

	const subtotalPence = lines.reduce((sum, line) => sum + line.lineTotalPence, 0);
	const weightGrams = lines.reduce((sum, line) => sum + line.available * line.massGrams, 0);
	const shipping =
		subtotalPence > 0 ? await quoteShipping(db, { country, subtotalPence, weightGrams }) : null;
	const shippingPence = shipping?.pricePence ?? 0;
	return {
		count: lines.reduce((sum, line) => sum + line.quantity, 0),
		country,
		...shippingOffer(country),
		lines,
		shipping,
		shippingPence,
		subtotalPence,
		totalPence: subtotalPence + shippingPence,
		weightGrams,
	};
}
