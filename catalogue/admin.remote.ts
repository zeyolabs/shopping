import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error404 } from '@zeyolabs/kit/utils/errors';
import { FormResult } from '@zeyolabs/kit/utils/form';
import { Schema } from '@zeyolabs/kit/utils/schema';
import { z } from 'zod';

import { shopping } from '../config';
import { CatalogueAdminService } from './admin.service.server';
import { CategoryFormSchema, ProductFormSchema } from './schema';

const admin = () => new CatalogueAdminService(shopping().db());

export const getAdminProducts = Remote.Query(z.string().max(100), (q) => {
	const service = admin();
	return service.products(q);
});

export const getAdminProduct = Remote.Query(Schema.Id, async (id) => {
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

/** Saves a product; `data.id` is its id (new products get one here). */
export const saveProductForm = Remote.Form(ProductFormSchema, async (input) => {
	const service = admin();
	const id = await service.saveProduct(input);
	await Promise.all([getAdminProduct(id).refresh(), getProductOptions().refresh()]);
	return FormResult.okData({ data: { id }, message: 'Product saved.' });
});

export const getAdminCategories = Remote.Query(() => {
	const service = admin();
	return service.categories();
});

export const saveCategoryForm = Remote.Form(CategoryFormSchema, async (input) => {
	const service = admin();
	await service.saveCategory(input);
	await Promise.all([getAdminCategories().refresh(), getProductOptions().refresh()]);
	return FormResult.ok('Category saved.');
});
