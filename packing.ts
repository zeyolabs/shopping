import type { BadgeColor } from '@zeyolabs/ui/badge/color';

import type { PackageFormat } from './db/schema';

export const FORMAT_LABELS: Record<PackageFormat, string> = {
	largeLetter: 'Large letter',
	letter: 'Letter',
	mediumParcel: 'Medium parcel',
	parcel: 'Parcel',
	smallParcel: 'Small parcel',
};

export type PackingStage = 'held' | 'label' | 'new' | 'packed' | 'packing' | 'shipped';

type PackingFields = {
	heldAt: null | number;
	labelCreatedAt: null | number;
	packedAt: null | number;
	packingStartedAt: null | number;
	shippedAt: null | number;
};

/** Where an order is in the packing flow. Later steps win, and a hold overrides until released. */
export function packingStage(order: PackingFields): PackingStage {
	if (order.shippedAt) return 'shipped';
	if (order.heldAt) return 'held';
	if (order.labelCreatedAt) return 'label';
	if (order.packedAt) return 'packed';
	if (order.packingStartedAt) return 'packing';
	return 'new';
}

export const STAGE_LABELS: Record<PackingStage, string> = {
	held: 'On hold',
	label: 'Label printed',
	new: 'To pack',
	packed: 'Packed',
	packing: 'Packing',
	shipped: 'Shipped',
};

export const STAGE_COLORS: Record<PackingStage, BadgeColor> = {
	held: 'neutral',
	label: 'success',
	new: 'warning',
	packed: 'purple',
	packing: 'info',
	shipped: 'success',
};
