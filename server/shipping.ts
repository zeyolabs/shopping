import { and, asc, eq, gte, isNotNull } from 'drizzle-orm';

import type { ShopDb } from '../db';

import { shopping } from '../config';
import { countries, shippingRates } from '../db/schema';
import { applyShippingRules } from '../shipping-rules';

export type ShippingQuote = {
	deliveryTime: string;
	name: string;
	pricePence: number;
	royalMailServiceCode: null | string;
	service: string;
};

export async function listShippableCountries(db: ShopDb) {
	return db
		.select({ code: countries.code, name: countries.name })
		.from(countries)
		.where(eq(countries.enabled, true))
		.orderBy(asc(countries.name));
}

/**
 * The cheapest postage for a parcel of `weightGrams` to `country`, or null when that country isn't
 * enabled, the parcel is heavier than every band, or the order value rules postage out.
 */
export async function quoteShipping(
	db: ShopDb,
	input: { country: string; subtotalPence: number; weightGrams: number }
): Promise<null | ShippingQuote> {
	const country = await db.query.countries.findFirst({
		where: and(eq(countries.code, input.country), eq(countries.enabled, true)),
	});
	if (!country) return null;

	const bands = await db
		.select()
		.from(shippingRates)
		.where(
			and(eq(shippingRates.zone, country.zone), gte(shippingRates.maxGrams, input.weightGrams))
		)
		.orderBy(asc(shippingRates.pricePence));
	const rate = bands[0];
	if (!rate) return null;

	const pricePence = applyShippingRules(shopping().shipping, {
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

/** The cheapest live UK rate, for pages that quote delivery so they never disagree with the basket. */
export async function getUkRate(db: ShopDb) {
	const [rate] = await db
		.select({ deliveryTime: shippingRates.deliveryTime, pricePence: shippingRates.pricePence })
		.from(shippingRates)
		.where(eq(shippingRates.zone, 'uk'))
		.orderBy(asc(shippingRates.pricePence))
		.limit(1);
	return rate ?? null;
}

/** The Click & Drop service code configured for a chosen service, if any. */
export async function quoteServiceCode(db: ShopDb, service: null | string): Promise<null | string> {
	if (!service) return null;
	const rate = await db.query.shippingRates.findFirst({
		where: and(eq(shippingRates.service, service), isNotNull(shippingRates.royalMailServiceCode)),
	});
	return rate?.royalMailServiceCode ?? null;
}
