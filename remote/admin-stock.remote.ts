import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { FormResult } from '@zeyolabs/kit/utils/form';

import { StockSchema } from '../admin/stock.schema';
import { listStock, setStock } from '../server/admin-stock';

export const getStock = Remote.Query(() => listStock());

export const setStockForm = Remote.Form(StockSchema, async ({ productId, stock }) => {
	await setStock(productId, stock);
	await getStock().refresh();
	return FormResult.ok('Stock saved.');
});
