import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error404 } from '@zeyolabs/kit/utils/errors';
import { z } from 'zod';

import { shopping } from '../config';
import { ReviewService } from '../reviews/service.server';
import { ShippingService } from '../shipping/service.server';
import { ShopSchema } from '../utils/schemas';
import { Search } from './library';
import { CatalogueService } from './service.server';

const catalogue = () => new CatalogueService(shopping().db());

/** The header's Shop menu. Cheap: a handful of rows. */
export const getMenuCategories = Remote.Query(async () => {
	const service = catalogue();
	return (await service.categories()).map(({ name, slug }) => ({ name, slug }));
});

const PageParam = z.number().int().min(1).max(10_000);

/** A page past the last one is a 404, so stale `?page=` links don't render an empty page. */
function checkPage<T extends { page: number; pages: number }>(listing: T): T {
	if (listing.page > listing.pages) throw Error404('Page not found');
	return listing;
}

export const getShop = Remote.Query(PageParam, async (page) => {
	const service = catalogue();
	const [categories, listing] = await Promise.all([
		service.categories(),
		service.productPage(page),
	]);
	return { categories, ...checkPage(listing) };
});

export const getCategoryPage = Remote.Query(
	z.object({ page: PageParam, slug: ShopSchema.SlugParam }),
	async ({ page, slug }) => {
		const service = catalogue();
		const category = await service.category(slug);
		if (!category) throw Error404('Category not found');
		return { category, ...checkPage(await service.productPage(page, category.id)) };
	}
);

export const getProduct = Remote.Query(ShopSchema.SlugParam, async (slug) => {
	const db = shopping().db();
	const service = new CatalogueService(db);
	const found = await service.product(slug);
	if (!found) throw Error404('Product not found');
	const reviews = new ReviewService(db);
	return { ...found, reviews: await reviews.forProduct(found.product.id) };
});

/** The page quotes the live UK rate so it can never disagree with the basket. */
export const getUkShippingRate = Remote.Query(async () => {
	const service = new ShippingService(shopping().db());
	return { freeFromPence: shopping().shipping.freeUkFromPence, rate: await service.ukRate() };
});

/** Search results for the search page; an empty query returns nothing. */
export const searchShop = Remote.Query(z.string().max(Search.MAX_LENGTH), async (query) => {
	const service = catalogue();
	return { products: await service.search(query), query };
});
