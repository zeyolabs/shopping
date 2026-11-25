// No 0/O/1/I: the number is read out over the phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Just what `chosenService` reads of a Checkout Session. */
type SessionShipping = {
	metadata: null | Record<string, string>;
	shipping_cost: null | { shipping_rate: null | string | { metadata: Record<string, string> } };
};

/** A bought bundle at the price paid, with the parts that make it up. */
export type BundleLine = {
	bundleId: null | number;
	name: string;
	parts: BundlePart[];
	quantity: number;
	unitPricePence: number;
};
export type BundlePart = {
	name: string;
	productId: null | number;
	quantity: number;
	singleUnits: boolean;
};
export type PlainLine = {
	name: string;
	productId: null | number;
	quantity: number;
	unitPricePence: number;
};

/**
 * Merges rows that share a key (a null key never merges). The quantities add up when they were
 * bought at one price; at different prices the row is one unit at the total, so the order's
 * money still adds up.
 */
function mergeBy<T extends { quantity: number; unitPricePence: number }>(
	rows: T[],
	key: (row: T) => null | string,
	combine: (into: T, from: T) => T
): T[] {
	const merged = new Map<string, T>();
	const out: T[] = [];
	for (const row of rows) {
		const id = key(row);
		const into = id === null ? undefined : merged.get(id);
		if (!into) {
			const copy = { ...row };
			out.push(copy);
			if (id !== null) merged.set(id, copy);
			continue;
		}
		const total = into.quantity * into.unitPricePence + row.quantity * row.unitPricePence;
		Object.assign(into, combine(into, row));
		if (into.unitPricePence === row.unitPricePence) {
			into.quantity += row.quantity;
		} else {
			into.quantity = 1;
			into.unitPricePence = total;
		}
	}
	return out;
}

/** Order numbers and links, and how a paid session's lines are tidied. Pure (apart from the random number). */
export const Orders = {
	/** Where Stripe serves an invoice: the PDF and the hosted page. SvelteKit refuses any other external redirect. */
	INVOICE_ORIGINS: ['https://pay.stripe.com', 'https://invoice.stripe.com'],

	/** Alphabetical, ignoring case; the caller breaks a tie (by id). */
	byName(a: { name: string }, b: { name: string }): number {
		return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
	},

	/**
	 * The postage service the customer chose at checkout: the chosen rate's `service` (fetched with
	 * `shipping_cost.shipping_rate` expanded). Sessions started before customers could choose kept it
	 * in the session's metadata.
	 */
	chosenService(session: SessionShipping): null | string {
		const rate = session.shipping_cost?.shipping_rate;
		const chosen = rate && typeof rate === 'object' ? rate.metadata.service : undefined;
		return chosen ?? session.metadata?.shippingService ?? null;
	},

	/**
	 * The order's lines in the shape the database keeps them: one row per product (and per bundle),
	 * so a repeat is merged, and a bundle's parts are one row per product and unit type. Sorted by
	 * name.
	 */
	tidy(lines: { bundles: BundleLine[]; items: PlainLine[] }): {
		bundles: BundleLine[];
		items: PlainLine[];
	} {
		const items = mergeBy(
			lines.items,
			(item) => (item.productId === null ? null : String(item.productId)),
			(into) => into
		).sort(Orders.byName);
		const bundles = mergeBy(
			lines.bundles,
			(bundle) => (bundle.bundleId === null ? null : String(bundle.bundleId)),
			(into, from) => ({ ...into, parts: [...into.parts, ...from.parts] })
		).map((bundle) => ({
			...bundle,
			parts: Orders.tidyParts(bundle.parts),
		}));
		return { bundles: bundles.sort(Orders.byName), items };
	},

	/** A bundle's parts as one row per product and unit type (quantities added), by name. */
	tidyParts(parts: BundlePart[]): BundlePart[] {
		const merged = new Map<string, BundlePart>();
		const out: BundlePart[] = [];
		for (const part of parts) {
			const key = part.productId === null ? null : `${part.productId}:${part.singleUnits}`;
			const into = key === null ? undefined : merged.get(key);
			if (into) {
				into.quantity += part.quantity;
				continue;
			}
			const copy = { ...part };
			out.push(copy);
			if (key !== null) merged.set(key, copy);
		}
		return out.sort(Orders.byName);
	},

	/** A new public order number, e.g. `PL-ABC234`. */
	newNumber(prefix: string): string {
		const bytes = crypto.getRandomValues(new Uint8Array(6));
		return `${prefix}-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')}`;
	},

	/** The private order page's path. The token is the only access control: never log or index it. */
	path(number: string, token: string): string {
		return `/order/${number}/${token}`;
	},

	/** Royal Mail's public tracker takes the number in the URL, so no API call is needed. */
	trackingUrl(trackingNumber: string): string {
		return `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(trackingNumber)}`;
	},

	/** The private order page's full URL on the shop's site. */
	url(siteUrl: string, number: string, token: string): string {
		return `${siteUrl}${Orders.path(number, token)}`;
	},
};
