export type JsonLdNode = Record<string, unknown>;

export type SeoReview = {
	body: string;
	createdAt: number;
	name: string;
	rating: number;
	title: string;
};

export type SeoReviews = { average: null | number; count: number; list: SeoReview[] };

const MAX_DESCRIPTION = 155;
const SCHEMA = 'https://schema.org';
const JSON_LD_ESCAPES: Record<string, string> = {
	'\u2028': '\\u2028',
	'\u2029': '\\u2029',
	'&': '\\u0026',
	'<': '\\u003c',
	'>': '\\u003e',
};

const collapse = (text: string) => text.replaceAll(/\s+/g, ' ').trim();

function listNames(names: string[]): string {
	if (names.length <= 1) return names.join('');
	return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

function compact(node: JsonLdNode): JsonLdNode {
	return Object.fromEntries(
		Object.entries(node).filter(([, value]) => value !== undefined && value !== '')
	);
}

/** Search and social metadata: descriptions, alt text, absolute URLs and schema.org JSON-LD. */
export const Seo = {
	MAX_DESCRIPTION,

	/** An absolute URL: `url` as is when it already is one, else joined to the site's origin. */
	absolute(siteUrl: string, url: string): string {
		if (/^https?:\/\//.test(url)) return url;
		return `${siteUrl.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
	},

	/** schema.org availability from the sellable count. */
	availability(stock: number): string {
		return `${SCHEMA}/${stock > 0 ? 'InStock' : 'OutOfStock'}`;
	},

	/** A `BreadcrumbList`; each step's `path` is a path or an absolute URL. */
	breadcrumbs(siteUrl: string, trail: { name: string; path: string }[]): JsonLdNode {
		return {
			'@type': 'BreadcrumbList',
			itemListElement: trail.map((step, index) => ({
				'@type': 'ListItem',
				item: Seo.absolute(siteUrl, step.path),
				name: step.name,
				position: index + 1,
			})),
		};
	},

	/** The category's own description when set, else one naming it and a few of its products. */
	categoryDescription(input: {
		description: string;
		name: string;
		productNames: string[];
		siteName: string;
		total: number;
	}): string {
		const own = collapse(input.description);
		if (own) return Seo.truncate(own);
		const names = input.productNames.slice(0, 3);
		if (input.total === 0 || names.length === 0) {
			return Seo.truncate(`Shop ${input.name} at ${input.siteName}.`);
		}
		const count = `${input.total} ${input.total === 1 ? 'product' : 'products'}`;
		return Seo.truncate(
			`${input.name} at ${input.siteName}: ${count}, including ${listNames(names)}.`
		);
	},

	/** The `alt` text of a product image: its own, else the product name with its variation label. */
	imageAlt(input: { alt?: null | string; label?: null | string; name: string }): string {
		const own = input.alt?.trim();
		if (own) return own;
		const label = input.label?.trim();
		return label ? `${input.name} - ${label}` : input.name;
	},

	/** JSON for a `<script type="application/ld+json">`, safe against `</script>` and `<!--` breakouts. */
	jsonLd(data: JsonLdNode): string {
		return JSON.stringify(data).replaceAll(
			/[\u2028\u2029&<>]/g,
			(character) => JSON_LD_ESCAPES[character]
		);
	},

	/** `YYYY-MM-DD` of an epoch-ms timestamp, for a sitemap `<lastmod>`. */
	lastmod(epochMs: number): string {
		return new Date(epochMs).toISOString().slice(0, 10);
	},

	/** The nodes as one `@graph` document. */
	graph(nodes: JsonLdNode[]): JsonLdNode {
		return { '@context': SCHEMA, '@graph': nodes };
	},

	organization(input: { email?: string; logo?: string; name: string; url: string }): JsonLdNode {
		return compact({
			'@type': 'Organization',
			email: input.email,
			logo: input.logo,
			name: input.name,
			url: input.url,
		});
	},

	/** A `Product` with a GBP `Offer`; rating and reviews only when there are approved reviews. */
	product(input: {
		brand: string;
		description: string;
		images: string[];
		name: string;
		pricePence: number;
		reviews?: SeoReviews;
		sku: string;
		stock: number;
		url: string;
	}): JsonLdNode {
		const { reviews } = input;
		const rated = reviews !== undefined && reviews.count > 0 && reviews.average !== null;
		return compact({
			'@type': 'Product',
			aggregateRating: rated
				? {
						'@type': 'AggregateRating',
						ratingValue: reviews.average,
						reviewCount: reviews.count,
					}
				: undefined,
			brand: { '@type': 'Brand', name: input.brand },
			description: input.description,
			image: input.images.length > 0 ? input.images : undefined,
			name: input.name,
			offers: {
				'@type': 'Offer',
				availability: Seo.availability(input.stock),
				itemCondition: `${SCHEMA}/NewCondition`,
				price: Seo.price(input.pricePence),
				priceCurrency: 'GBP',
				url: input.url,
			},
			review:
				rated && reviews.list.length > 0
					? reviews.list.map((review) =>
							compact({
								'@type': 'Review',
								author: { '@type': 'Person', name: review.name },
								datePublished: Seo.lastmod(review.createdAt),
								name: review.title,
								reviewBody: review.body,
								reviewRating: { '@type': 'Rating', bestRating: 5, ratingValue: review.rating },
							})
						)
					: undefined,
			sku: input.sku,
		});
	},

	/** Meta description of a product: its own text, or one built from its name and category. */
	productDescription(input: {
		category?: string;
		description: string;
		name: string;
		shortDescription: string;
		siteName: string;
	}): string {
		const own = collapse(input.shortDescription) || collapse(input.description);
		if (own) return Seo.truncate(own);
		const category = input.category ? ` (${input.category})` : '';
		return Seo.truncate(`Buy ${input.name}${category} online from ${input.siteName}.`);
	},

	/** Pounds with two decimals, as schema.org wants a price: `1250` is `12.50`. */
	price(pence: number): string {
		return (pence / 100).toFixed(2);
	},

	/** Whitespace collapsed and cut to `max` characters on a word boundary, with an ellipsis. */
	truncate(text: string, max = MAX_DESCRIPTION): string {
		const clean = collapse(text);
		if (clean.length <= max) return clean;
		const room = clean.slice(0, max - 1);
		const space = clean[max - 1] === ' ' ? room.length : room.lastIndexOf(' ');
		const cut = space > 0 ? room.slice(0, space) : room;
		return `${cut.replace(/[\s,.;:\-–]+$/, '')}…`;
	},

	website(input: { name: string; url: string }): JsonLdNode {
		return { '@type': 'WebSite', name: input.name, url: input.url };
	},
};
