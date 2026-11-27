import { describe, expect, it } from 'vitest';

import { ClickAndDropRules } from './click-and-drop-rules';

const second = { serviceCode: 'OLP2', serviceName: 'Royal Mail 2nd Class' };

describe('ClickAndDropRules.check', () => {
	it('refuses the generic parcel on 2nd Class and suggests a small parcel', () => {
		expect(ClickAndDropRules.check({ ...second, format: 'parcel', weightGrams: 360 })).toEqual({
			ok: false,
			reason:
				'Royal Mail 2nd Class does not take the Parcel format; use Small parcel (up to 2 kg).',
			suggestion: 'smallParcel',
		});
	});

	it('suggests the smallest format that fits', () => {
		expect(
			ClickAndDropRules.suggest({ format: 'letter', serviceCode: 'OLP1', weightGrams: 90 })
		).toBe('letter');
		expect(
			ClickAndDropRules.suggest({ format: 'letter', serviceCode: 'OLP1', weightGrams: 100 })
		).toBe('letter');
		expect(
			ClickAndDropRules.suggest({ format: 'letter', serviceCode: 'OLP1', weightGrams: 101 })
		).toBe('largeLetter');
		expect(
			ClickAndDropRules.suggest({ format: 'letter', serviceCode: 'OLP1', weightGrams: 751 })
		).toBe('smallParcel');
		expect(
			ClickAndDropRules.suggest({ format: 'letter', serviceCode: 'OLP1', weightGrams: 2000 })
		).toBe('smallParcel');
		expect(
			ClickAndDropRules.suggest({ format: 'letter', serviceCode: 'OLP1', weightGrams: 2001 })
		).toBeUndefined();
	});

	it('moves a parcel to a small parcel and never shrinks the chosen format', () => {
		const base = { serviceCode: 'OLP2', weightGrams: 360 };
		expect(ClickAndDropRules.suggest({ ...base, format: 'parcel' })).toBe('smallParcel');
		expect(ClickAndDropRules.suggest({ ...base, format: 'smallParcel' })).toBe('smallParcel');
		expect(ClickAndDropRules.suggest({ ...base, format: 'letter' })).toBe('largeLetter');
		expect(
			ClickAndDropRules.suggest({ ...base, format: 'parcel', weightGrams: 2500 })
		).toBeUndefined();
	});

	it('accepts formats within their weight limit', () => {
		for (const [format, weightGrams] of [
			['letter', 100],
			['largeLetter', 750],
			['smallParcel', 2000],
		] as const) {
			expect(ClickAndDropRules.check({ ...second, format, weightGrams })).toEqual({ ok: true });
		}
	});

	it('refuses a format that is too light for the weight', () => {
		const result = ClickAndDropRules.check({ ...second, format: 'letter', weightGrams: 360 });
		expect(result).toMatchObject({ ok: false, suggestion: 'largeLetter' });
		expect(result.ok === false && result.reason).toContain('up to 100 g');
	});

	it('has no suggestion when nothing fits', () => {
		const result = ClickAndDropRules.check({ ...second, format: 'parcel', weightGrams: 3000 });
		expect(result).toMatchObject({ ok: false });
		expect(result).not.toHaveProperty('suggestion', 'smallParcel');
		expect((result as { suggestion?: unknown }).suggestion).toBeUndefined();
	});

	it('applies the same rules to the Signed For variants', () => {
		for (const serviceCode of ['OLP1SF', 'OLP2SF', 'olp2']) {
			expect(ClickAndDropRules.check({ format: 'parcel', serviceCode, weightGrams: 300 }).ok).toBe(
				false
			);
		}
	});

	it('passes tracked and unknown services', () => {
		for (const serviceCode of ['TOLP24', 'TOLP48SF', 'XYZ', null]) {
			expect(ClickAndDropRules.check({ format: 'parcel', serviceCode, weightGrams: 9000 })).toEqual(
				{
					ok: true,
				}
			);
			expect(
				ClickAndDropRules.suggest({ format: 'letter', serviceCode, weightGrams: 300 })
			).toBeUndefined();
		}
	});
});
