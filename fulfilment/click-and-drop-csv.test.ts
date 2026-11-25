import { describe, expect, it } from 'vitest';

import { ClickAndDropCsv, type ClickAndDropRow } from './click-and-drop-csv';

const row: ClickAndDropRow = {
	address: {
		city: 'London',
		country: 'GB',
		line1: '1 High St',
		line2: null,
		name: 'Ann Lee',
		phone: '0123',
		postcode: 'N1 1AA',
	},
	createdAt: Date.UTC(2026, 10, 5, 12),
	email: 'a@b.test',
	number: 'PL-ABC123',
	packageFormat: 'smallParcel',
	serviceCode: 'TPN24',
	shippingPence: 350,
	subtotalPence: 1999,
	totalPence: 2349,
	weightGrams: 420,
};

const lines = (csv: string) => csv.split('\r\n');

describe('ClickAndDropCsv.build', () => {
	it('starts with Royal Mail’s field names', () => {
		expect(lines(ClickAndDropCsv.build([row]))[0]).toBe(
			'Order reference,Full name,Address Line 1,Address Line 2,City,County,Postcode,Country,Email,Phone,Weight,Package Size,Service code,Date,Currency Code,Shipping Cost,Sub-total,Total'
		);
	});

	it('writes one row per order with kilograms, pounds and a DD/MM/YY date', () => {
		const csv = ClickAndDropCsv.build([row, { ...row, number: 'PL-2', serviceCode: null }]);
		const out = lines(csv);
		expect(out).toHaveLength(4);
		expect(out[1]).toBe(
			'PL-ABC123,Ann Lee,1 High St,,London,,N1 1AA,GB,a@b.test,0123,0.420,Small parcel,TPN24,05/11/26,GBP,3.50,19.99,23.49'
		);
		expect(out[2]).toContain(',Small parcel,,05/11/26,');
		expect(csv.endsWith('\r\n')).toBe(true);
	});

	it('writes weight in kg with three decimals', () => {
		const out = lines(
			ClickAndDropCsv.build([
				{ ...row, weightGrams: 100 },
				{ ...row, weightGrams: 1250 },
			])
		);
		expect(out[1]).toContain(',0.100,');
		expect(out[2]).toContain(',1.250,');
	});

	it('quotes commas, quotes and newlines', () => {
		const csv = ClickAndDropCsv.build([
			{ ...row, address: { ...row.address, line1: 'Flat 1, "The" House', line2: 'a\nb' } },
		]);
		expect(csv).toContain('"Flat 1, ""The"" House","a\nb"');
	});

	it('prefixes cells that start like a formula', () => {
		const csv = ClickAndDropCsv.build([
			{ ...row, address: { ...row.address, line1: '=1+1', name: '@cmd' }, email: '-x@b.test' },
		]);
		expect(csv).toContain("'@cmd,'=1+1");
		expect(csv).toContain("'-x@b.test");
	});
});
