import { describe, expect, it } from 'vitest';

import { Packing } from './library';

const none = {
	heldAt: null,
	labelCreatedAt: null,
	packedAt: null,
	packingStartedAt: null,
	shippedAt: null,
};

describe('packingStage', () => {
	it('starts as new and follows the latest step', () => {
		expect(Packing.stage(none)).toBe('new');
		expect(Packing.stage({ ...none, packingStartedAt: 1 })).toBe('packing');
		expect(Packing.stage({ ...none, packedAt: 2, packingStartedAt: 1 })).toBe('packed');
		expect(Packing.stage({ ...none, labelCreatedAt: 3, packedAt: 2, packingStartedAt: 1 })).toBe(
			'label'
		);
	});

	it('shows a hold until it is released, and shipped beats everything', () => {
		expect(Packing.stage({ ...none, heldAt: 5, packedAt: 2 })).toBe('held');
		expect(Packing.stage({ ...none, heldAt: 5, shippedAt: 9 })).toBe('shipped');
	});
});
