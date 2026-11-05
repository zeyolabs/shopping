import { formatMinorUnits } from '@zeyolabs/kit/utils/money';

/** Shops sell in GBP; prices are integer pence. */
export const formatMoney = (pence: number): string => formatMinorUnits(pence, 'GBP', 'en-GB');
