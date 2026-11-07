// Stock arithmetic, pure and framework-free (a library: an object of static functions, no db). Stock
// is held in single units; a product sold in packs has `packSize` above 1 and sells in whole packs.

/** One component of a combined product: `quantity` of it goes into each set. */
export type StockComponent = StockLine & { quantity: number };
export type StockLine = { packSize: number; stock: number };

/** What the badge on a product card should say. */
export type StockBadge = { count: number; kind: 'low' } | { kind: 'in' } | { kind: 'out' };

export const Stock = {
	/** What the card shows: out of stock at 0, "only N left" at or below the threshold, else in stock. */
	badge(sellable: number, lowStockThreshold: null | number | undefined): StockBadge {
		if (sellable <= 0) return { kind: 'out' };
		if (lowStockThreshold != null && sellable <= lowStockThreshold) {
			return { count: sellable, kind: 'low' };
		}
		return { kind: 'in' };
	},

	/**
	 * Complete sets a combined product can be sold as: the fewest the components allow, each
	 * component's whole packs divided by the quantity one set takes. No components: 0.
	 */
	combinedAvailable(components: readonly StockComponent[]): number {
		if (components.length === 0) return 0;
		return Math.min(
			...components.map((c) =>
				Math.floor(Stock.sellable(c.stock, c.packSize) / Math.max(1, c.quantity))
			)
		);
	},

	/** Total sellable across the variations of one group, for listing pages. Never stored. */
	groupTotal(variants: readonly StockLine[]): number {
		return variants.reduce((sum, v) => sum + Stock.sellable(v.stock, v.packSize), 0);
	},

	/** Whole packs available. A negative stock or a pack size below 1 is treated as empty / single. */
	sellable(stock: number, packSize = 1): number {
		return Math.floor(Math.max(0, stock) / Math.max(1, packSize));
	},
};
