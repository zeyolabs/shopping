import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error404 } from '@zeyolabs/kit/utils/errors';
import { z } from 'zod';

import { CategoryInputSchema, ProductInputSchema } from '../admin/products.schema';
import { BundleInputSchema } from '../bundles.schema';
import { shopping } from '../config';
import {
	getProductForEdit,
	listCategoriesForAdmin,
	listProducts,
	listVariationGroups,
	saveCategory,
	saveProduct,
} from '../server/admin-products';
import { BundleService } from '../server/bundles';

const Id = z.number().int().positive();

export const getAdminProducts = Remote.Query(z.string().max(100), (q) => listProducts(q));

export const getAdminProduct = Remote.Query(Id, async (id) => {
	const product = await getProductForEdit(id);
	if (!product) throw Error404('Product not found.');
	return product;
});

/** Categories and variation groups, for the product editor's pickers. */
export const getProductOptions = Remote.Query(async () => {
	const [categories, groups] = await Promise.all([listCategoriesForAdmin(), listVariationGroups()]);
	return { categories, variationGroups: groups.map((g) => g.name) };
});

/** Saves a product and returns its id (new products get one here). */
export const saveProductCmd = Remote.Cmd(ProductInputSchema, async (input) => {
	const id = await saveProduct(input);
	await Promise.all([getAdminProduct(id).refresh(), getProductOptions().refresh()]);
	return { id };
});

export const getAdminCategories = Remote.Query(() => listCategoriesForAdmin());

export const saveCategoryCmd = Remote.Cmd(CategoryInputSchema, async (input) => {
	const id = await saveCategory(input);
	await Promise.all([getAdminCategories().refresh(), getProductOptions().refresh()]);
	return { id };
});

const bundleService = () => new BundleService(shopping().db());

export const getAdminBundles = Remote.Query(() => bundleService().list());

export const getAdminBundle = Remote.Query(Id, async (id) => {
	const bundle = await bundleService().forEdit(id);
	if (!bundle) throw Error404('Bundle not found.');
	return bundle;
});

export const saveBundleCmd = Remote.Cmd(BundleInputSchema, async (input) => {
	const id = await bundleService().save(input);
	await Promise.all([getAdminBundles().refresh(), getAdminBundle(id).refresh()]);
	return { id };
});
