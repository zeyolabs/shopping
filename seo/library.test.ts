import { describe, expect, it } from 'vitest';

import { Seo } from './library';

const reviews = {
	average: 4.5,
	count: 2,
	list: [
		{ body: 'Great', createdAt: Date.UTC(2026, 0, 5), name: 'Sam', rating: 5, title: 'Loved it' },
		{ body: '', createdAt: Date.UTC(2026, 1, 6), name: 'Alex', rating: 4, title: '' },
	],
};

const product = {
	brand: 'KeyCrox',
	description: 'A switch.',
	images: ['https://cdn.example/a.webp'],
	name: 'Switch',
	pricePence: 1250,
	sku: 'SW-1',
	stock: 3,
	url: 'https://shop.example/product/switch',
};

describe('Seo.truncate', () => {
	it('leaves short text alone and collapses whitespace', () => {
		expect(Seo.truncate('  a \n b  ')).toBe('a b');
	});

	it('cuts on a word boundary within the limit', () => {
		const out = Seo.truncate('one two three four five', 14);
		expect(out).toBe('one two three…');
		expect(out.length).toBeLessThanOrEqual(14);
	});

	it('hard-cuts a single long word', () => {
		expect(Seo.truncate('abcdefghij', 5)).toBe('abcd…');
	});

	it('stays within 155 characters by default', () => {
		expect(Seo.truncate('word '.repeat(100)).length).toBeLessThanOrEqual(155);
	});
});

describe('Seo.jsonLd', () => {
	it('escapes characters that could end the script element', () => {
		const out = Seo.jsonLd({ name: '</script><script>alert(1)</script> <!-- & \u2028\u2029' });
		expect(out).not.toMatch(/[<>&\u2028\u2029]/);
		expect(out).toContain('\\u003c/script\\u003e');
		expect(JSON.parse(out).name).toBe('</script><script>alert(1)</script> <!-- & \u2028\u2029');
	});
});

describe('Seo.product', () => {
	it('builds the offer in pounds with availability', () => {
		const node = Seo.product(product);
		expect(node['offers']).toEqual({
			'@type': 'Offer',
			availability: 'https://schema.org/InStock',
			itemCondition: 'https://schema.org/NewCondition',
			price: '12.50',
			priceCurrency: 'GBP',
			url: product.url,
		});
		expect(node).toMatchObject({ brand: { name: 'KeyCrox' }, sku: 'SW-1' });
		expect(node['image']).toEqual(product.images);
	});

	it('maps no stock to OutOfStock', () => {
		expect(Seo.availability(0)).toBe('https://schema.org/OutOfStock');
		expect(Seo.availability(1)).toBe('https://schema.org/InStock');
	});

	it('has no rating or reviews without approved reviews', () => {
		for (const given of [undefined, { average: null, count: 0, list: [] }]) {
			const node = Seo.product({ ...product, reviews: given });
			expect(node).not.toHaveProperty('aggregateRating');
			expect(node).not.toHaveProperty('review');
		}
	});

	it('adds rating and reviews when there are approved ones', () => {
		const node = Seo.product({ ...product, reviews });
		expect(node['aggregateRating']).toEqual({
			'@type': 'AggregateRating',
			ratingValue: 4.5,
			reviewCount: 2,
		});
		const list = node['review'] as Record<string, unknown>[];
		expect(list).toHaveLength(2);
		expect(list[0]['datePublished']).toBe('2026-01-05');
		expect(list[1]).not.toHaveProperty('reviewBody');
	});

	it('omits image when there is none', () => {
		expect(Seo.product({ ...product, images: [] })).not.toHaveProperty('image');
	});
});

describe('Seo.breadcrumbs, organization, website', () => {
	it('numbers the trail with absolute URLs', () => {
		const node = Seo.breadcrumbs('https://shop.example/', [
			{ name: 'Home', path: '/' },
			{ name: 'Keys', path: '/category/keys' },
		]);
		expect((node['itemListElement'] as unknown[])[1]).toEqual({
			'@type': 'ListItem',
			item: 'https://shop.example/category/keys',
			name: 'Keys',
			position: 2,
		});
	});

	it('leaves out an unset logo', () => {
		const node = Seo.organization({ email: 'a@b.c', name: 'Shop', url: 'https://shop.example' });
		expect(node).not.toHaveProperty('logo');
		expect(node.email).toBe('a@b.c');
		expect(Seo.website({ name: 'Shop', url: 'https://shop.example' })['@type']).toBe('WebSite');
	});

	it('wraps nodes in a graph', () => {
		expect(Seo.graph([{ '@type': 'WebSite' }])['@context']).toBe('https://schema.org');
	});
});

describe('descriptions', () => {
	it('uses the product text when there is some', () => {
		expect(
			Seo.productDescription({
				description: 'long',
				name: 'N',
				shortDescription: 'short',
				siteName: 'S',
			})
		).toBe('short');
	});

	it('builds one when the product has none, never empty', () => {
		const out = Seo.productDescription({
			category: 'Mugs',
			description: ' ',
			name: 'Korean Mug',
			shortDescription: '',
			siteName: 'Pure Leaves',
		});
		expect(out).toBe('Buy Korean Mug (Mugs) online from Pure Leaves.');
		expect(
			Seo.productDescription({ description: '', name: 'X', shortDescription: '', siteName: 'S' })
		).toBe('Buy X online from S.');
	});

	it('uses a category description or names the category and products', () => {
		const base = { name: 'Mugs', productNames: ['A', 'B', 'C', 'D'], siteName: 'S', total: 4 };
		expect(Seo.categoryDescription({ ...base, description: 'Own text.' })).toBe('Own text.');
		expect(Seo.categoryDescription({ ...base, description: '' })).toBe(
			'Mugs at S: 4 products, including A, B and C.'
		);
		expect(Seo.categoryDescription({ ...base, description: '', productNames: [], total: 0 })).toBe(
			'Shop Mugs at S.'
		);
	});
});

describe('helpers', () => {
	it('makes URLs absolute', () => {
		expect(Seo.absolute('https://s.example', '/a')).toBe('https://s.example/a');
		expect(Seo.absolute('https://s.example/', 'a')).toBe('https://s.example/a');
		expect(Seo.absolute('https://s.example', 'https://cdn/x.webp')).toBe('https://cdn/x.webp');
	});

	it('builds alt text', () => {
		expect(Seo.imageAlt({ alt: ' Own ', label: 'Red', name: 'Mug' })).toBe('Own');
		expect(Seo.imageAlt({ alt: '', label: 'Red', name: 'Mug' })).toBe('Mug - Red');
		expect(Seo.imageAlt({ alt: null, name: 'Mug' })).toBe('Mug');
	});

	it('formats lastmod as a date', () => {
		expect(Seo.lastmod(Date.UTC(2026, 10, 26, 23, 59))).toBe('2026-11-26');
	});
});
