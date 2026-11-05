import { describe, expect, it } from 'vitest';

import { parseBasket } from './basket';

describe('parseBasket', () => {
	it('reads a valid cookie', () => {
		expect(parseBasket('{"3":2,"7":1}')).toEqual({ 3: 2, 7: 1 });
	});

	it('ignores junk', () => {
		expect(parseBasket(undefined)).toEqual({});
		expect(parseBasket('not json')).toEqual({});
		expect(parseBasket('[1,2]')).toEqual({});
		expect(parseBasket('{"x":2,"-1":1,"4":0,"5":1.5,"6":"2"}')).toEqual({});
	});

	it('caps absurd quantities', () => {
		expect(parseBasket('{"1":5000}')).toEqual({ 1: 99 });
	});
});
