import { and, asc, eq, inArray } from 'drizzle-orm';

import type { ShippingRules } from '../config';
import type { ShopDb } from '../db/index';
import type { Basket, BasketBundle } from './library';

import { type BundlePart, BundleService } from '../bundles/service.server';
import { CoverService } from '../catalogue/covers.server';
import { products } from '../db/schema';
import { type ShippingQuote, ShippingService } from '../shipping/service.server';
import { StockService } from '../stock/service.server';
import { ErrorMessage } from '../utils/errors';

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

/** A kit or discounted bundle: one line at one price, re-checked against the catalogue on every read. */
export type BasketBundleLine = {
	/** False when it can no longer be bought as chosen; `problem` says why. */
	available: boolean;
	bundleId: number;
	cover: null | { alt: string; src: string };
	/** What was chosen, one line each. */
	details: string[];
	/** Its position in the bundles cookie, for removing it. */
	index: number;
	/** The parts at their own prices; above `pricePence` when there is a discount. */
	listPricePence: number;
	massGrams: number;
	name: string;
	parts: BundlePart[];
	pricePence: number;
	problem: null | string;
	slug: string;
};

export type BasketSummary = {
	bundles: BasketBundleLine[];
	/** Total items in the basket, for the header badge. */
	count: number;
	country: string;
	/** True when `country` is the shop's home country, where the free-delivery offer applies. */
	domestic: boolean;
	/** UK orders at or above this subtotal ship free. */
	freeShippingFromPence: number;
	lines: BasketLine[];
	/** The cheapest option; null when nothing can ship to `country` for this basket. */
	shipping: null | ShippingQuote;
	/** Every service that can send it, cheapest first; the customer picks one at checkout. */
	shippingOptions: ShippingQuote[];
	/** The cheapest option's price, so `totalPence` is the lowest the order can cost. */
	shippingPence: number;
	subtotalPence: number;
	totalPence: number;
	weightGrams: number;
};

/** Prices a basket from current catalogue data, with the shop's postage rules passed in. */
export class BasketService {
	constructor(private readonly db: ShopDb) {}

	/** Inactive or deleted products drop out; quantities are capped by stock and max per order. */
	async summarise(
		basket: Basket,
		country: string,
		rules: ShippingRules,
		bundleEntries: BasketBundle[] = []
	): Promise<BasketSummary> {
		const offer = {
			domestic: country === rules.defaultCountry,
			freeShippingFromPence: rules.freeUkFromPence,
		};
		const ids = Object.keys(basket).map(Number);
		if (ids.length === 0 && bundleEntries.length === 0) {
			return {
				bundles: [],
				count: 0,
				country,
				...offer,
				lines: [],
				shipping: null,
				shippingOptions: [],
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

		const bundleLines = await this.bundleLines(bundleEntries, rows, lines);
		const ready = bundleLines.filter((b) => b.available);
		const subtotalPence =
			lines.reduce((sum, line) => sum + line.lineTotalPence, 0) +
			ready.reduce((sum, b) => sum + b.pricePence, 0);
		const weightGrams =
			lines.reduce((sum, line) => sum + line.available * line.massGrams, 0) +
			ready.reduce((sum, b) => sum + b.massGrams, 0);
		const shippingService = new ShippingService(this.db);
		const shippingOptions =
			subtotalPence > 0
				? await shippingService.quotes(rules, { country, subtotalPence, weightGrams })
				: [];
		const shipping = shippingOptions[0] ?? null;
		const shippingPence = shipping?.pricePence ?? 0;
		return {
			bundles: bundleLines,
			count: lines.reduce((sum, line) => sum + line.quantity, 0) + bundleLines.length,
			country,
			...offer,
			lines,
			shipping,
			shippingOptions,
			shippingPence,
			subtotalPence,
			totalPence: subtotalPence + shippingPence,
			weightGrams,
		};
	}

	/**
	 * Re-checks and prices each kept bundle. A bundle that no longer resolves, or whose parts the
	 * stock cannot cover on top of the ordinary lines and the bundles before it, is unavailable.
	 */
	private async bundleLines(
		entries: BasketBundle[],
		rows: (typeof products.$inferSelect)[],
		lines: BasketLine[]
	): Promise<BasketBundleLine[]> {
		if (entries.length === 0) return [];
		const bundles = new BundleService(this.db);
		const resolved = await Promise.all(
			entries.map((entry) =>
				bundles.resolve(entry.bundleId, entry.choices).then(
					(value) => ({ value }),
					(error: unknown) => ({ error })
				)
			)
		);
		const partIds = [
			...new Set(
				resolved.flatMap((r) => ('value' in r ? r.value.parts.map((p) => p.productId) : []))
			),
		];
		const raw = partIds.length
			? await this.db
					.select({ id: products.id, packSize: products.packSize, stock: products.stock })
					.from(products)
					.where(inArray(products.id, partIds))
			: [];
		const stockOf = new Map(raw.map((r) => [r.id, r]));
		// Single units already spoken for by the ordinary lines.
		const used = new Map<number, number>();
		for (const line of lines) {
			const row = rows.find((r) => r.id === line.id);
			used.set(line.id, line.available * (row?.packSize ?? 1));
		}
		const covers = new CoverService(this.db);
		const cover = await covers.covers(partIds.slice(0, 50));

		return resolved.map((result, index) => {
			const entry = entries[index];
			if ('error' in result) {
				const message = ErrorMessage.from(result.error, 'This bundle is no longer available.');
				return {
					available: false,
					bundleId: entry.bundleId,
					cover: null,
					details: [],
					index,
					listPricePence: 0,
					massGrams: 0,
					name: 'Bundle',
					parts: [],
					pricePence: 0,
					problem: message,
					slug: '',
				};
			}
			const bundle = result.value;
			let problem: null | string = null;
			for (const part of bundle.parts) {
				const row = stockOf.get(part.productId);
				const units = part.singleUnits ? part.quantity : part.quantity * (row?.packSize ?? 1);
				const after = (used.get(part.productId) ?? 0) + units;
				if (!row || after > row.stock) {
					problem = `Not enough ${part.name} left for this bundle.`;
					break;
				}
			}
			if (!problem) {
				for (const part of bundle.parts) {
					const row = stockOf.get(part.productId)!;
					const units = part.singleUnits ? part.quantity : part.quantity * row.packSize;
					used.set(part.productId, (used.get(part.productId) ?? 0) + units);
				}
			}
			const first = bundle.parts[0];
			return {
				available: problem === null,
				bundleId: bundle.bundle.id,
				cover: bundle.bundle.image
					? { alt: bundle.bundle.name, src: bundle.bundle.image }
					: ((first && cover.get(first.productId)) ?? null),
				details: bundle.details,
				index,
				listPricePence: bundle.listPricePence,
				massGrams: bundle.massGrams,
				name: bundle.bundle.name,
				parts: bundle.parts,
				pricePence: bundle.pricePence,
				problem,
				slug: bundle.bundle.slug,
			};
		});
	}
}
