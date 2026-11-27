import type { PackageFormat } from '../db/schema';

import { Packing } from './library';

export type ClickAndDropCheck =
	{ ok: false; reason: string; suggestion?: PackageFormat } | { ok: true };

type CheckInput = {
	format: PackageFormat;
	serviceCode: null | string;
	serviceName?: null | string;
	weightGrams: number;
};

type Limits = Partial<Record<PackageFormat, number>>;

/** Royal Mail 1st and 2nd Class (and Signed For): the formats Click & Drop accepts, with the heaviest each takes. Smallest first. */
const FIRST_SECOND_CLASS: Limits = { largeLetter: 750, letter: 100, smallParcel: 2000 };

const RESTRICTED: Record<string, Limits> = {
	OLP1: FIRST_SECOND_CLASS,
	OLP1SF: FIRST_SECOND_CLASS,
	OLP2: FIRST_SECOND_CLASS,
	OLP2SF: FIRST_SECOND_CLASS,
};

const BY_SIZE: PackageFormat[] = ['letter', 'largeLetter', 'smallParcel', 'parcel'];

function limitsFor(serviceCode: null | string): Limits | undefined {
	return serviceCode ? RESTRICTED[serviceCode.trim().toUpperCase()] : undefined;
}

function weight(grams: number) {
	return grams >= 1000 ? `${grams / 1000} kg` : `${grams} g`;
}

/** What Click & Drop accepts for a service, so a doomed order is stopped before the API sees it. Pure. */
export const ClickAndDropRules = {
	/** Whether Click & Drop will take this format and weight on this service. Unknown services pass. */
	check({ format, serviceCode, serviceName, weightGrams }: CheckInput): ClickAndDropCheck {
		const limits = limitsFor(serviceCode);
		if (!limits) return { ok: true };
		const name = serviceName || serviceCode || 'This service';
		const suggestion = ClickAndDropRules.suggest({ serviceCode, weightGrams });
		const label = Packing.FORMAT_LABELS[format];
		const max = limits[format];

		if (max === undefined) {
			const options = BY_SIZE.filter((f) => limits[f] !== undefined)
				.map((f) => `${Packing.FORMAT_LABELS[f]} (up to ${weight(limits[f] as number)})`)
				.join(', ');
			const advice = suggestion
				? `use ${Packing.FORMAT_LABELS[suggestion]} (up to ${weight(limits[suggestion] as number)}).`
				: `this ${weight(weightGrams)} parcel is over all of: ${options}. Choose another service.`;
			return {
				ok: false,
				reason: `${name} does not take the ${label} format; ${advice}`,
				suggestion,
			};
		}
		if (weightGrams > max) {
			const advice = suggestion
				? `use ${Packing.FORMAT_LABELS[suggestion]}.`
				: 'it is too heavy for this service; choose another.';
			return {
				ok: false,
				reason: `${name} takes ${label} up to ${weight(max)} and this parcel is ${weight(weightGrams)}; ${advice}`,
				suggestion,
			};
		}
		return { ok: true };
	},

	/** The smallest accepted format that fits the weight; undefined when the service has no format rules or none fits. */
	suggest({
		serviceCode,
		weightGrams,
	}: Pick<CheckInput, 'serviceCode' | 'weightGrams'>): PackageFormat | undefined {
		const limits = limitsFor(serviceCode);
		if (!limits) return undefined;
		return BY_SIZE.find((f) => (limits[f] ?? -1) >= weightGrams);
	},
};
