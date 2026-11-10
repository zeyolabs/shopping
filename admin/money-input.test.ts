import { describe, expect, it } from 'vitest';

import { parsePounds, penceToPounds, slugify } from './money-input';

describe('parsePounds', () => {
	it('reads pounds and pence', () => {
		expect(parsePounds('12.5')).toBe(1250);
		expect(parsePounds('£1,234.05')).toBe(123405);
		expect(parsePounds('7')).toBe(700);
		expect(parsePounds('')).toBeNull();
		expect(parsePounds('1.234')).toBeNaN();
		expect(parsePounds('abc')).toBeNaN();
	});
	it('round-trips', () => {
		expect(penceToPounds(1205)).toBe('12.05');
		expect(parsePounds(penceToPounds(99))).toBe(99);
		expect(penceToPounds(null)).toBe('');
	});
});

describe('slugify', () => {
	it('makes URL slugs', () => {
		expect(slugify('Green Tea — 100g!')).toBe('green-tea-100g');
		expect(slugify('Café Crème')).toBe('cafe-creme');
	});
});
