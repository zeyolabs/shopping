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

	/**
	 * The cheapest postage for a parcel of `weightGrams` to `country`, or null when that country
	 * isn't enabled, the parcel is heavier than every band, or the order value rules postage out.
	 */
	async quote(
		rules: ShippingRules,
		input: { country: string; subtotalPence: number; weightGrams: number }
	): Promise<null | ShippingQuote> {
		const country = await this.db.query.countries.findFirst({
			where: and(eq(countries.code, input.country), eq(countries.enabled, true)),
		});
		if (!country) return null;

		const bands = await this.db
			.select()
			.from(shippingRates)
			.where(
				and(eq(shippingRates.zone, country.zone), gte(shippingRates.maxGrams, input.weightGrams))
			)
			.orderBy(asc(shippingRates.pricePence));
		const rate = bands[0];
		if (!rate) return null;

		const pricePence = Postage.charge(rules, {
			basePence: rate.pricePence,
			subtotalPence: input.subtotalPence,
			zone: country.zone,
		});
		if (pricePence === null) return null;

		return {
			deliveryTime: rate.deliveryTime,
			name: rate.name,
			pricePence,
			royalMailServiceCode: rate.royalMailServiceCode,
			service: rate.service,
		};
	}

	/** The Click & Drop service code configured for a chosen service, if any. */
	async serviceCode(service: null | string): Promise<null | string> {
		if (!service) return null;
		const rate = await this.db.query.shippingRates.findFirst({
			where: and(eq(shippingRates.service, service), isNotNull(shippingRates.royalMailServiceCode)),
		});
		return rate?.royalMailServiceCode ?? null;
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
