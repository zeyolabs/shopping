import type { ShippingRules } from '../config';

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
