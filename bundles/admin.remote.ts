import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error404 } from '@zeyolabs/kit/utils/errors';
import { FormResult } from '@zeyolabs/kit/utils/form';
import { Schema } from '@zeyolabs/kit/utils/schema';

import { shopping } from '../config';
import { BundleFormSchema } from './schema';
import { BundleService } from './service.server';

const bundles = () => new BundleService(shopping().db());

export const getAdminBundles = Remote.Query(() => {
	const service = bundles();
	return service.list();
});

export const getAdminBundle = Remote.Query(Schema.Id, async (id) => {
	const service = bundles();
	const bundle = await service.forEdit(id);
	if (!bundle) throw Error404('Bundle not found.');
	return bundle;
});

/** Saves a bundle and all its steps; `data.id` is its id (new bundles get one here). */
export const saveBundleForm = Remote.Form(BundleFormSchema, async (input) => {
	const service = bundles();
	const id = await service.save(input);
	await Promise.all([getAdminBundles().refresh(), getAdminBundle(id).refresh()]);
	return FormResult.okData({ data: { id }, message: 'Bundle saved.' });
});
