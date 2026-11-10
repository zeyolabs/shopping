import type { BadgeColor } from '@zeyolabs/ui/badge/color';

import type { PackageFormat } from '../db/schema';

export type PackingStage = 'held' | 'label' | 'new' | 'packed' | 'packing' | 'shipped';

type PackingFields = {
	heldAt: null | number;
	labelCreatedAt: null | number;
	packedAt: null | number;
	packingStartedAt: null | number;
	shippedAt: null | number;
};

/** The packing flow: stages, their labels and badge colours. Pure. */
export const Packing = {
	FORMAT_LABELS: {
		largeLetter: 'Large letter',
		letter: 'Letter',
		mediumParcel: 'Medium parcel',
		parcel: 'Parcel',
		smallParcel: 'Small parcel',
	} satisfies Record<PackageFormat, string>,

	STAGE_COLORS: {
		held: 'neutral',
		label: 'success',
		new: 'warning',
		packed: 'purple',
		packing: 'info',
		shipped: 'success',
	} satisfies Record<PackingStage, BadgeColor>,

	STAGE_LABELS: {
		held: 'On hold',
		label: 'Label printed',
		new: 'To pack',
		packed: 'Packed',
		packing: 'Packing',
		shipped: 'Shipped',
	} satisfies Record<PackingStage, string>,

	/** Where an order is in the packing flow. Later steps win, and a hold overrides until released. */
	stage(order: PackingFields): PackingStage {
		if (order.shippedAt) return 'shipped';
		if (order.heldAt) return 'held';
		if (order.labelCreatedAt) return 'label';
		if (order.packedAt) return 'packed';
		if (order.packingStartedAt) return 'packing';
		return 'new';
	},
};
