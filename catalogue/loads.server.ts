import { error, isHttpError, redirect } from '@sveltejs/kit';

import { shopping } from '../config';
import {
	getCategoryPage,
	getMenuCategories,
	getProduct,
	getShop,
	getUkShippingRate,
	searchShop,
} from './client.remote';
import { CatalogueService } from './service.server';

/**
 * Server `load`s for the public catalogue pages. They call the same remote queries the client uses,
 * so there is one implementation, but run them during the request: a missing product or category
 * becomes a real 404 response, which a `<svelte:boundary>` would turn into a 200 page.
 */

type SlugEvent = { params: { slug?: string }; url: URL };

/** The header's category menu, so its links are in the server-rendered HTML on every page. */
export async function layoutLoad() {
	return { menuCategories: await getMenuCategories() };
}

export async function shopLoad() {
	return { shop: await getShop() };
}

export async function categoryLoad({ params }: SlugEvent) {
	return { page: await getCategoryPage(params.slug ?? '') };
}

/** Legacy links (`/product/<old-slug>`, `/product/<parent>?variant=<code>`) redirect; unknown slugs 404. */
export async function productLoad({ params, url }: SlugEvent) {
	const slug = params.slug ?? '';
	try {
		return { page: await getProduct(slug) };
	} catch (err) {
		if (!isHttpError(err, 404)) throw err;
	}
	const service = new CatalogueService(shopping().db());
	const target = await service.redirect({
		legacySlug: slug,
		variantSku: url.searchParams.get('variant'),
	});
	if (target) redirect(301, `/product/${target}`);
	error(404, 'Product not found');
}

/** `/search?q=`: the results are in the server-rendered page. */
export async function searchLoad({ url }: { url: URL }) {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	return { search: await searchShop(q) };
}

export async function shippingLoad() {
	return { shipping: await getUkShippingRate() };
}
