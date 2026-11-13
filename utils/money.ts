import { formatMinorUnits } from '@zeyolabs/kit/utils/money';

/** Shops sell in GBP; prices are integer pence. */
export const Money = {
	/** 1250 to "£12.50". */
	format(pence: number): string {
		return formatMinorUnits(pence, 'GBP', 'en-GB');
	},
};
