import { renderEmail, renderEmailText } from '@zeyolabs/kit/utils/email';
import { describe, expect, it } from 'vitest';

import { shopping } from '../config';
import { BackInStockEmail } from './email';

const data = {
	email: 'sam@example.com',
	pricePence: 1250,
	productName: 'Jeju Green',
	slug: 'jeju-green',
};

describe('backInStockEmail', () => {
	it('links to the product page and says stock is limited', () => {
		const params = BackInStockEmail.build(data, shopping());
		expect(params.heading).toBe('Jeju Green is back');
		expect(params.cta).toEqual({
			href: BackInStockEmail.productUrl(shopping().siteUrl, 'jeju-green'),
			label: 'View product',
		});
		const text = renderEmailText(params);
		expect(text).toContain('https://test.example/product/jeju-green');
		expect(text).toContain('£12.50');
		expect(text).toContain('limited');
	});

	it('escapes the product name in the html', () => {
		const html = renderEmail(
			BackInStockEmail.build({ ...data, productName: '<b>Tea</b>' }, shopping())
		);
		expect(html).not.toContain('<b>Tea</b>');
	});
});
