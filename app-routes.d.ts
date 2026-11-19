// The routes this package's pages link to; every app that renders them must have these. Apps get
// their real route types from SvelteKit; this stands in for them when the package is checked on its
// own, and is not published.
export {};

declare module '$app/types' {
	export interface AppTypes {
		RouteId():
			| '/'
			| '/basket'
			| '/bundle/[slug]'
			| '/bundles'
			| '/bundles/[id]'
			| '/bundles/new'
			| '/categories'
			| '/category/[slug]'
			| '/orders'
			| '/orders/[number]'
			| '/orders/[number]/label'
			| '/product/[slug]'
			| '/products'
			| '/products/[id]'
			| '/products/new'
			| '/reviews'
			| '/shop';
		RouteParams(): {
			'/bundle/[slug]': { slug: string };
			'/bundles/[id]': { id: string };
			'/category/[slug]': { slug: string };
			'/orders/[number]': { number: string };
			'/orders/[number]/label': { number: string };
			'/product/[slug]': { slug: string };
			'/products/[id]': { id: string };
		};
	}
}
