import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error404 } from '@zeyolabs/kit/utils/errors';
import { z } from 'zod';

import { shopping } from '../config';
import {
	getProduct as findProduct,
	getCategory,
	listCategories,
	listCategoryProducts,
	listShopProducts,
} from '../server/catalogue';
import { getUkRate } from '../server/shipping';

const Slug = z.string().min(1).max(200);

/** The header's Shop menu. Cheap: a handful of rows. */
export const getMenuCategories = Remote.Query(async () =>
	(await listCategories(shopping().db())).map(({ name, slug }) => ({ name, slug }))
);

export const getShop = Remote.Query(async () => {
	const db = shopping().db();
	const [categories, products] = await Promise.all([listCategories(db), listShopProducts(db)]);
	return { categories, products };
});

export const getCategoryPage = Remote.Query(Slug, async (slug) => {
	const db = shopping().db();
	const category = await getCategory(db, slug);
	if (!category) throw Error404('Category not found');
	return { category, products: await listCategoryProducts(db, category.id) };
});

export const getProduct = Remote.Query(Slug, async (slug) => {
	const found = await findProduct(shopping().db(), slug);
	if (!found) throw Error404('Product not found');
	return found;
});

/** The page quotes the live UK rate so it can never disagree with the basket. */
export const getUkShippingRate = Remote.Query(async () => ({
	freeFromPence: shopping().shipping.freeUkFromPence,
	rate: await getUkRate(shopping().db()),
}));
