import { and, asc, eq, gte, isNotNull } from 'drizzle-orm';

import type { ShippingRules } from '../config';
import type { ShopDb } from '../db/index';

import { countries, shippingRates } from '../db/schema';
import { Postage } from './library';

export type ShippingQuote = {
	deliveryTime: string;
	name: string;
	pricePence: number;
	royalMailServiceCode: null | string;
	service: string;
};

type QuoteInput = { country: string; subtotalPence: number; weightGrams: number };

/** Stripe Checkout offers at most this many shipping options. */
export const MAX_SHIPPING_OPTIONS = 5;

/** Countries and postage rates: data access, with the shop's postage rules passed in. */
export class ShippingService {
	constructor(private readonly db: ShopDb) {}

	/** Countries that can be chosen at checkout, by name. */
	async countries() {
		return this.db
			.select({ code: countries.code, name: countries.name })
			.from(countries)
			.where(eq(countries.enabled, true))
			.orderBy(asc(countries.name));
	}

	/** The cheapest postage for this parcel, or null when nothing can send it (see `quotes`). */
	async quote(rules: ShippingRules, input: QuoteInput): Promise<null | ShippingQuote> {
		const [cheapest] = await this.quotes(rules, input);
		return cheapest ?? null;
	}

	/**
	 * Every service that can send a parcel of `weightGrams` to `country`, each at its cheapest band,
	 * cheapest first: at most `MAX_SHIPPING_OPTIONS`, the most Stripe Checkout offers. Empty when
	 * that country isn't enabled, the parcel is heavier than every band, or the order value rules
	 * postage out.
	 */
	async quotes(rules: ShippingRules, input: QuoteInput): Promise<ShippingQuote[]> {
		const country = await this.db.query.countries.findFirst({
			where: and(eq(countries.code, input.country), eq(countries.enabled, true)),
		});
		if (!country) return [];

		const bands = await this.db
			.select()
			.from(shippingRates)
			.where(
				and(eq(shippingRates.zone, country.zone), gte(shippingRates.maxGrams, input.weightGrams))
			)
			.orderBy(asc(shippingRates.pricePence), asc(shippingRates.maxGrams));
		const seen = new Set<string>();
		const quotes: ShippingQuote[] = [];
		for (const rate of bands) {
			if (seen.has(rate.service)) continue;
			seen.add(rate.service);
			const pricePence = Postage.charge(rules, {
				basePence: rate.pricePence,
				subtotalPence: input.subtotalPence,
				zone: country.zone,
			});
			if (pricePence === null) return [];
			quotes.push({
				deliveryTime: rate.deliveryTime,
				name: rate.name,
				pricePence,
				royalMailServiceCode: rate.royalMailServiceCode,
				service: rate.service,
			});
		}
		return quotes.slice(0, MAX_SHIPPING_OPTIONS);
	}

	/** The Click & Drop service code configured for a chosen service, if any. */
	async serviceCode(service: null | string): Promise<null | string> {
		if (!service) return null;
		const rate = await this.db.query.shippingRates.findFirst({
			where: and(eq(shippingRates.service, service), isNotNull(shippingRates.royalMailServiceCode)),
		});
		return rate?.royalMailServiceCode ?? null;
	}

	/** The shop's display name for a postage service, e.g. "Royal Mail 2nd Class". */
	async serviceName(service: null | string): Promise<null | string> {
		if (!service) return null;
		const rate = await this.db.query.shippingRates.findFirst({
			where: eq(shippingRates.service, service),
		});
		return rate?.name ?? null;
	}

	/** The distinct postage services that have a rate, for the admin's service picker. */
	async services() {
		const rows = await this.db
			.selectDistinct({ name: shippingRates.name, service: shippingRates.service })
			.from(shippingRates)
			.orderBy(asc(shippingRates.service));
		return rows;
	}

	/** The cheapest UK rate, for pages that quote delivery so they never disagree with the basket. */
	async ukRate() {
		const [rate] = await this.db
			.select({ deliveryTime: shippingRates.deliveryTime, pricePence: shippingRates.pricePence })
			.from(shippingRates)
			.where(eq(shippingRates.zone, 'uk'))
			.orderBy(asc(shippingRates.pricePence))
			.limit(1);
		return rate ?? null;
	}
}
