import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error404 } from '@zeyolabs/kit/utils/errors';
import { z } from 'zod';

import { shopping } from '../config';
import { BundleInputSchema } from './schema';
import { BundleService } from './service.server';

const bundles = () => new BundleService(shopping().db());

export const getAdminBundles = Remote.Query(() => {
	const service = bundles();
	return service.list();
});

export const getAdminBundle = Remote.Query(z.number().int().positive(), async (id) => {
	const service = bundles();
	const bundle = await service.forEdit(id);
	if (!bundle) throw Error404('Bundle not found.');
	return bundle;
});

export const saveBundleCmd = Remote.Cmd(BundleInputSchema, async (input) => {
	const service = bundles();
	const id = await service.save(input);
	await Promise.all([getAdminBundles().refresh(), getAdminBundle(id).refresh()]);
	return { id };
});
