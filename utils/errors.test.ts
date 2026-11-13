import { describe, expect, it } from 'vitest';

import { ErrorMessage } from './errors';

describe('ErrorMessage.from', () => {
	it('prefers the server message, then the error, then the fallback', () => {
		expect(ErrorMessage.from({ body: { message: 'Out of stock' } }, 'x')).toBe('Out of stock');
		expect(ErrorMessage.from(new Error('Boom'), 'x')).toBe('Boom');
		expect(ErrorMessage.from('nope', 'Try again')).toBe('Try again');
		expect(ErrorMessage.from({ body: {} }, 'Try again')).toBe('Try again');
	});
});
