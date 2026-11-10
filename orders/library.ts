// No 0/O/1/I: the number is read out over the phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Order numbers and links. Pure (apart from the random number). */
export const Orders = {
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
