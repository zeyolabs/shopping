import { shopping } from './config';

/** The order page's path on the shop's own site (for links within the site). */
export function orderPath(number: string, token: string): string {
	return `/order/${number}/${token}`;
}

/** The customer's private order page. The token is the only access control, so never log or index it. */
export function orderUrl(number: string, token: string): string {
	return `${shopping().siteUrl}${orderPath(number, token)}`;
}

/** Royal Mail's public tracker takes the number in the URL, so no API call is needed. */
export function trackingUrl(trackingNumber: string): string {
	return `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(trackingNumber)}`;
}
