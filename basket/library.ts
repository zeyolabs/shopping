/** `{ [productId]: quantity }`, as stored in the basket cookie. Prices always come from D1. */
export type Basket = Record<number, number>;

const MAX_LINES = 30;
const MAX_QUANTITY = 99;

/** The basket cookie's contents. Pure. */
export const BasketCookie = {
	MAX_QUANTITY,

	/** Adds `quantity` of a product, capped. Returns a new basket. */
	add(basket: Basket, productId: number, quantity: number): Basket {
		return { ...basket, [productId]: Math.min((basket[productId] ?? 0) + quantity, MAX_QUANTITY) };
	},

	/** A cookie value to a basket. Junk, bad ids and bad quantities are dropped, not thrown. */
	parse(raw: string | undefined): Basket {
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
				basket[id] = Math.min(value as number, MAX_QUANTITY);
			}
		}
		return basket;
	},

	/** Sets a line's quantity; 0 removes it. Returns a new basket. */
	set(basket: Basket, productId: number, quantity: number): Basket {
		const next = { ...basket };
		if (quantity === 0) delete next[productId];
		else next[productId] = Math.min(quantity, MAX_QUANTITY);
		return next;
	},
};

/**
 * A bundle kept as one basket line (a kit or a discounted bundle): its id and, per step, the chosen
 * product ids (a `fill` step repeats an id per slot). Re-checked and re-priced on every read.
 */
export type BasketBundle = {
	bundleId: number;
	choices: { productIds: number[]; stepId: number }[];
};

const MAX_BUNDLES = 10;
const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

/** The bundles cookie's contents. Pure. */
export const BasketBundles = {
	MAX: MAX_BUNDLES,

	/** Adds a bundle at the end; the oldest drops off past the limit. Returns a new list. */
	add(list: BasketBundle[], entry: BasketBundle): BasketBundle[] {
		return [...list, entry].slice(-MAX_BUNDLES);
	},

	/** A cookie value to bundles. Junk is dropped, not thrown. */
	parse(raw: string | undefined): BasketBundle[] {
		if (!raw) return [];
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return [];
		}
		if (!Array.isArray(parsed)) return [];
		const out: BasketBundle[] = [];
		for (const item of parsed.slice(0, MAX_BUNDLES)) {
			if (!item || typeof item !== 'object' || !isId(item.bundleId) || !Array.isArray(item.choices))
				continue;
			const choices = (item.choices as unknown[])
				.slice(0, 20)
				.filter(
					(c): c is { productIds: number[]; stepId: number } =>
						!!c &&
						typeof c === 'object' &&
						isId((c as { stepId: unknown }).stepId) &&
						Array.isArray((c as { productIds: unknown }).productIds) &&
						(c as { productIds: unknown[] }).productIds.length <= 64 &&
						(c as { productIds: unknown[] }).productIds.every(isId)
				)
				.map((c) => ({ productIds: [...c.productIds], stepId: c.stepId }));
			out.push({ bundleId: item.bundleId, choices });
		}
		return out;
	},

	/** Removes the bundle at `index`. Returns a new list. */
	remove(list: BasketBundle[], index: number): BasketBundle[] {
		return list.filter((_, i) => i !== index);
	},
};
