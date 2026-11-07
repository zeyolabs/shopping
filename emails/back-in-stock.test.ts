import { renderEmail, renderEmailText } from '@zeyolabs/kit/utils/email';
import { describe, expect, it } from 'vitest';

import { backInStockEmail, productUrl } from './back-in-stock';

const data = {
	email: 'sam@example.com',
	pricePence: 1250,
	productName: 'Jeju Green',
	slug: 'jeju-green',
};

describe('backInStockEmail', () => {
	it('links to the product page and says stock is limited', () => {
		const params = backInStockEmail(data);
		expect(params.heading).toBe('Jeju Green is back');
		expect(params.cta).toEqual({ href: productUrl('jeju-green'), label: 'View product' });
		const text = renderEmailText(params);
		expect(text).toContain('https://test.example/product/jeju-green');
		expect(text).toContain('£12.50');
		expect(text).toContain('limited');
	});

	it('escapes the product name in the html', () => {
		const html = renderEmail(backInStockEmail({ ...data, productName: '<b>Tea</b>' }));
		expect(html).not.toContain('<b>Tea</b>');
	});
});
