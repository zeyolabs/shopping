import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error404 } from '@zeyolabs/kit/utils/errors';
import { z } from 'zod';

import { shopping } from '../config';
import { CatalogueAdminService } from './admin.service.server';
import { CategoryInputSchema, ProductInputSchema } from './schema';

const Id = z.number().int().positive();

const admin = () => new CatalogueAdminService(shopping().db());

export const getAdminProducts = Remote.Query(z.string().max(100), (q) => {
	const service = admin();
	return service.products(q);
});

export const getAdminProduct = Remote.Query(Id, async (id) => {
	const service = admin();
	const product = await service.productForEdit(id);
	if (!product) throw Error404('Product not found.');
	return product;
});

/** Categories and variation groups, for the product editor's pickers. */
export const getProductOptions = Remote.Query(async () => {
	const service = admin();
	const [categories, groups] = await Promise.all([service.categories(), service.variationGroups()]);
	return { categories, variationGroups: groups.map((g) => g.name) };
});

/** Saves a product and returns its id (new products get one here). */
export const saveProductCmd = Remote.Cmd(ProductInputSchema, async (input) => {
	const service = admin();
	const id = await service.saveProduct(input);
	await Promise.all([getAdminProduct(id).refresh(), getProductOptions().refresh()]);
	return { id };
});

export const getAdminCategories = Remote.Query(() => {
	const service = admin();
	return service.categories();
});

export const saveCategoryCmd = Remote.Cmd(CategoryInputSchema, async (input) => {
	const service = admin();
	const id = await service.saveCategory(input);
	await Promise.all([getAdminCategories().refresh(), getProductOptions().refresh()]);
	return { id };
});
