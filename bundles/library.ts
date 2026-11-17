/** Bundle editor values. Pure. */
export const BundleSku = {
	/** The editor's text for a step's product: the reverse of `parse`. */
	format(p: { pricePence: null | number; sku: string; slots: null | number }): string {
		if (!p.slots) return p.sku;
		return p.pricePence === null
			? `${p.sku}=${p.slots}`
			: `${p.sku}=${p.slots}@${(p.pricePence / 100).toFixed(2)}`;
	},

	/**
	 * A step's product as the editor writes it: `SKU`, or for a kit base `SKU=16` (holds 16) or
	 * `SKU=35@37.00` (holds 35, and the kit costs £37.00 rather than the product's own price).
	 */
	parse(entry: string): { pricePence: null | number; sku: string; slots: null | number } {
		const match = /^(.+?)=(\d{1,3})(?:@(\d{1,5}(?:\.\d{1,2})?))?$/.exec(entry.trim());
		if (!match) return { pricePence: null, sku: entry.trim(), slots: null };
		const slots = Number(match[2]);
		return {
			pricePence: match[3] ? Math.round(Number(match[3]) * 100) : null,
			sku: match[1].trim(),
			slots: slots > 0 ? slots : null,
		};
	},
};

export type EncodedPart = { productId: number; quantity: number; singleUnits: boolean };

/**
 * A grouped bundle's parts as one Stripe metadata value (500 characters at most): `id:qty:s` per
 * part, `s` 1 for single units, joined by `|`. Pure.
 */
export const BundleParts = {
	decode(value: string | undefined): EncodedPart[] {
		if (!value) return [];
		return value.split('|').flatMap((chunk) => {
			const [id, qty, single] = chunk.split(':').map(Number);
			return Number.isInteger(id) && id > 0 && Number.isInteger(qty) && qty > 0
				? [{ productId: id, quantity: qty, singleUnits: single === 1 }]
				: [];
		});
	},

	encode(parts: readonly EncodedPart[]): string {
		const value = parts
			.map((p) => `${p.productId}:${p.quantity}:${p.singleUnits ? 1 : 0}`)
			.join('|');
		if (value.length > 500) throw new Error('Bundle has too many parts for Stripe metadata');
		return value;
	},
};
