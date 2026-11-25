import type { PackageFormat } from '../db/schema';

import { Packing } from './library';

export type ClickAndDropRow = {
	address: {
		city: string;
		country: string;
		line1: string;
		line2: null | string;
		name: string;
		phone: null | string;
		postcode: string;
	};
	createdAt: number;
	email: string;
	number: string;
	packageFormat: PackageFormat;
	serviceCode: null | string;
	shippingPence: number;
	subtotalPence: number;
	totalPence: number;
	weightGrams: number;
};

const HEADERS = [
	'Order reference',
	'Full name',
	'Address Line 1',
	'Address Line 2',
	'City',
	'County',
	'Postcode',
	'Country',
	'Email',
	'Phone',
	'Weight',
	'Package Size',
	'Service code',
	'Date',
	'Currency Code',
	'Shipping Cost',
	'Sub-total',
	'Total',
];

const day = new Intl.DateTimeFormat('en-GB', {
	day: '2-digit',
	month: '2-digit',
	timeZone: 'Europe/London',
	year: '2-digit',
});

const pounds = (pence: number) => (pence / 100).toFixed(2);

/** A cell that a spreadsheet would run as a formula gets a leading quote; then CSV quoting. */
function cell(value: null | string | undefined): string {
	let text = value ?? '';
	if (/^[=+\-@]/.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Royal Mail Click & Drop's order import spreadsheet, as CSV. Pure. */
export const ClickAndDropCsv = {
	HEADERS,

	build(orders: ClickAndDropRow[]): string {
		const rows = orders.map((o) => [
			o.number,
			o.address.name,
			o.address.line1,
			o.address.line2,
			o.address.city,
			'',
			o.address.postcode,
			o.address.country,
			o.email,
			o.address.phone,
			(o.weightGrams / 1000).toFixed(3),
			Packing.FORMAT_LABELS[o.packageFormat],
			o.serviceCode,
			day.format(o.createdAt),
			'GBP',
			pounds(o.shippingPence),
			pounds(o.subtotalPence),
			pounds(o.totalPence),
		]);
		return [HEADERS, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
	},
};
