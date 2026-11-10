/** "12.5" or "£12.50" to 1250 pence; null for blank; NaN when it is not a price. */
export function parsePounds(value: string): null | number {
	const clean = value.replace(/[£,\s]/g, '');
	if (clean === '') return null;
	if (!/^\d+(\.\d{1,2})?$/.test(clean)) return Number.NaN;
	const [whole, frac = ''] = clean.split('.');
	return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** 1250 pence to "12.50" for an input. */
export function penceToPounds(pence: null | number | undefined): string {
	if (pence === null || pence === undefined) return '';
	return `${Math.floor(pence / 100)}.${String(pence % 100).padStart(2, '0')}`;
}

/** A title to a URL slug: "Green Tea 100g" to "green-tea-100g". */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 120);
}
