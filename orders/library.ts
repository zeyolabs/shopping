// No 0/O/1/I: the number is read out over the phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Just what `chosenService` reads of a Checkout Session. */
type SessionShipping = {
	metadata: null | Record<string, string>;
	shipping_cost: null | { shipping_rate: null | string | { metadata: Record<string, string> } };
};

/** Order numbers and links. Pure (apart from the random number). */
export const Orders = {
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
