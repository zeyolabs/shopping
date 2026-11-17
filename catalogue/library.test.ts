import { describe, expect, it } from 'vitest';

import { ProductText } from './library';

describe('ProductText.parse', () => {
	it('splits paragraphs, headings and spec lists', () => {
		const text = [
			'A smooth linear switch.',
			'',
			'Broad compatibility',
			'Fits most MX boards.',
			'',
			'Profile: Linear',
			'Spring weight: 63.5g',
			'Stem material: UNKNOWN',
		].join('\n');
		expect(ProductText.parse(text)).toEqual({
			paragraphs: [
				{ heading: null, text: 'A smooth linear switch.' },
				{ heading: 'Broad compatibility', text: 'Fits most MX boards.' },
			],
			specs: [
				{ label: 'Profile', value: 'Linear' },
				{ label: 'Spring weight', value: '63.5g' },
			],
		});
	});

	it('keeps a lone "Label: sentence" line as text', () => {
		expect(ProductText.parse('Note: ships in a plain box.').specs).toEqual([]);
	});

	it('does not treat a sentence as a heading', () => {
		const { paragraphs } = ProductText.parse('Comes in a box.\nTwo per pack.');
		expect(paragraphs).toEqual([{ heading: null, text: 'Comes in a box.\nTwo per pack.' }]);
	});
});

describe('ProductText.visibleCount', () => {
	it('shows everything when short and folds long text after the first paragraphs', () => {
		const short = [{ heading: null, text: 'a'.repeat(100) }];
		expect(ProductText.visibleCount(short)).toBe(1);
		const long = [0, 1, 2].map(() => ({ heading: null, text: 'a'.repeat(400) }));
		expect(ProductText.visibleCount(long)).toBe(1);
	});
});
