import { and, asc, eq, inArray } from 'drizzle-orm';

import type { ShippingRules } from '../config';
import type { ShopDb } from '../db/index';
import type { Basket } from './library';

import { CoverService } from '../catalogue/covers.server';
import { products } from '../db/schema';
import { type ShippingQuote, ShippingService } from '../shipping/service.server';
import { StockService } from '../stock/service.server';

export type BasketLine = {
	/** What the customer can actually buy right now: min(requested, sellable, max per order). */
	available: number;
	cover: null | { alt: string; src: string };
	id: number;
	/** The most of this product one order can hold: min(sellable, max per order). */
	limit: number;
	lineTotalPence: number;
	massGrams: number;
	name: string;
	pricePence: number;
	quantity: number;
	sku: string;
	slug: string;
	/** Units that can be sold now (whole packs, or complete sets), not the raw stock count. */
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
	/** Null when nothing can ship to `country` for this basket. */
	shipping: null | ShippingQuote;
	shippingPence: number;
	subtotalPence: number;
	totalPence: number;
	weightGrams: number;
};

/** Prices a basket from current catalogue data, with the shop's postage rules passed in. */
export class BasketService {
	constructor(private readonly db: ShopDb) {}

	/** Inactive or deleted products drop out; quantities are capped by stock and max per order. */
	async summarise(basket: Basket, country: string, rules: ShippingRules): Promise<BasketSummary> {
		const offer = {
			domestic: country === rules.defaultCountry,
			freeShippingFromPence: rules.freeUkFromPence,
		};
		const ids = Object.keys(basket).map(Number);
		if (ids.length === 0) {
			return {
				count: 0,
				country,
				...offer,
				lines: [],
				shipping: null,
				shippingPence: 0,
				subtotalPence: 0,
				totalPence: 0,
				weightGrams: 0,
			};
		}

		const rows = await this.db
			.select()
			.from(products)
			.where(and(inArray(products.id, ids), eq(products.active, true)))
			.orderBy(asc(products.name));
		const stock = new StockService(this.db);
		const sellable = await stock.availableMany(rows.map((p) => p.id));
		const covers = new CoverService(this.db);
		const cover = await covers.covers(rows.map((p) => p.id));

		const lines = rows.map((product): BasketLine => {
			const quantity = basket[product.id];
			const inStock = sellable.get(product.id) ?? 0;
			const available = Math.max(0, Math.min(quantity, inStock, product.maxPerOrder));
			const image = cover.get(product.id);
			return {
				available,
				cover: image ?? null,
				id: product.id,
				limit: Math.max(0, Math.min(inStock, product.maxPerOrder)),
				lineTotalPence: available * product.pricePence,
				massGrams: product.massGrams,
				name: product.name,
				pricePence: product.pricePence,
				quantity,
				sku: product.sku,
				slug: product.slug,
				stock: inStock,
			};
		});

		const subtotalPence = lines.reduce((sum, line) => sum + line.lineTotalPence, 0);
		const weightGrams = lines.reduce((sum, line) => sum + line.available * line.massGrams, 0);
		const shippingService = new ShippingService(this.db);
		const shipping =
			subtotalPence > 0
				? await shippingService.quote(rules, { country, subtotalPence, weightGrams })
				: null;
		const shippingPence = shipping?.pricePence ?? 0;
		return {
			count: lines.reduce((sum, line) => sum + line.quantity, 0),
			country,
			...offer,
			lines,
			shipping,
			shippingPence,
			subtotalPence,
			totalPence: subtotalPence + shippingPence,
			weightGrams,
		};
	}
}
