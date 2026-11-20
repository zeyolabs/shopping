import type { ShippingRules } from '../config';

import { SHIPPING_FORMATS, type ShippingFormat } from '../db/schema';

/** Royal Mail sizes: which one an order needs, and which rates cover it. Pure. */
export const Parcels = {
	/** The size an order needs: its largest item's. An empty order needs the smallest. */
	largest(formats: Iterable<ShippingFormat>): ShippingFormat {
		let rank = 0;
		for (const format of formats) rank = Math.max(rank, SHIPPING_FORMATS.indexOf(format));
		return SHIPPING_FORMATS[rank];
	},

	/** The smallest of some products' sizes, e.g. for a "delivery from" price. None: the smallest. */
	smallest(formats: ShippingFormat[]): ShippingFormat {
		if (formats.length === 0) return SHIPPING_FORMATS[0];
		return SHIPPING_FORMATS[Math.min(...formats.map((f) => SHIPPING_FORMATS.indexOf(f)))];
	},

	/** Whether a rate priced for `rateFormat` (null: any size) covers a parcel of `format`. */
	covers(rateFormat: null | ShippingFormat, format: ShippingFormat): boolean {
		return (
			rateFormat === null ||
			SHIPPING_FORMATS.indexOf(rateFormat) >= SHIPPING_FORMATS.indexOf(format)
		);
	},
};

/** Postage rules layered on the rate table. Pure. */
export const Postage = {
	/** The customer's postage charge, or null when the order can't be shipped to that zone. */
	charge(
		rules: ShippingRules,
		input: { basePence: number; subtotalPence: number; zone: string }
	): null | number {
		if (input.zone === 'uk') {
			return input.subtotalPence >= rules.freeUkFromPence ? 0 : input.basePence;
		}
		if (input.subtotalPence >= rules.internationalMaxOrderPence) return null;
		return input.subtotalPence >= rules.insuranceFromPence
			? input.basePence + rules.insuranceUpliftPence
			: input.basePence;
	},
};
