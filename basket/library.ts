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
