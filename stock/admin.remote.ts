import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { FormResult } from '@zeyolabs/kit/utils/form';

import { shopping } from '../config';
import { StockSchema } from './schema';
import { StockService } from './service.server';

export const getStock = Remote.Query(() => {
	const service = new StockService(shopping().db());
	return service.list();
});

/** Sets a product's stock in single units. Waiting customers are emailed by the stock-alerts job, not here. */
export const setStockForm = Remote.Form(StockSchema, async ({ productId, stock }) => {
	const service = new StockService(shopping().db());
	await service.setStock(productId, stock);
	await getStock().refresh();
	return FormResult.ok('Stock saved.');
});
