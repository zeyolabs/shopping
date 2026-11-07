import type { EmailParams } from '@zeyolabs/kit/utils/email';

import { shopping } from '../config';
import { formatMoney } from '../money';

export type BackInStockEmailData = {
	email: string;
	pricePence: number;
	productName: string;
	slug: string;
};

/** The product page the customer lands on from the email. */
export const productUrl = (slug: string): string => `${shopping().siteUrl}/product/${slug}`;

/** Sent once to each customer who asked to be told when a sold-out product is back. */
export function backInStockEmail(data: BackInStockEmailData): EmailParams {
	const { brand } = shopping();
	const url = productUrl(data.slug);
	return {
		badge: 'Back in stock',
		brand,
		cta: { href: url, label: 'View product' },
		eyebrow: 'Back in stock',
		footnote:
			'You are getting this one email because you asked us to tell you. We will not send another about this product.',
		heading: `${data.productName} is back`,
		intro: [
			`Good news: ${data.productName} (${formatMoney(data.pricePence)}) is back in stock at ${brand.name}.`,
			'Stock is limited, so if you want it, do not wait too long.',
			`You can see it here: ${url}`,
		],
		preheader: `${data.productName} is back in stock. Stock is limited.`,
		sections: [],
	};
}
