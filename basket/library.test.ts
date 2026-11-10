import { describe, expect, it } from 'vitest';

import { BasketCookie } from './library';

describe('BasketCookie.parse', () => {
	it('reads a valid cookie', () => {
		expect(BasketCookie.parse('{"3":2,"7":1}')).toEqual({ 3: 2, 7: 1 });
	});

	it('ignores junk', () => {
		expect(BasketCookie.parse(undefined)).toEqual({});
		expect(BasketCookie.parse('not json')).toEqual({});
		expect(BasketCookie.parse('[1,2]')).toEqual({});
		expect(BasketCookie.parse('{"x":2,"-1":1,"4":0,"5":1.5,"6":"2"}')).toEqual({});
	});

	it('caps absurd quantities', () => {
		expect(BasketCookie.parse('{"1":5000}')).toEqual({ 1: 99 });
	});
});
