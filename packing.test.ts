import { describe, expect, it } from 'vitest';

import { packingStage } from './packing';

const none = {
	heldAt: null,
	labelCreatedAt: null,
	packedAt: null,
	packingStartedAt: null,
	shippedAt: null,
};

describe('packingStage', () => {
	it('starts as new and follows the latest step', () => {
		expect(packingStage(none)).toBe('new');
		expect(packingStage({ ...none, packingStartedAt: 1 })).toBe('packing');
		expect(packingStage({ ...none, packedAt: 2, packingStartedAt: 1 })).toBe('packed');
		expect(packingStage({ ...none, labelCreatedAt: 3, packedAt: 2, packingStartedAt: 1 })).toBe(
			'label'
		);
	});

	it('shows a hold until it is released, and shipped beats everything', () => {
		expect(packingStage({ ...none, heldAt: 5, packedAt: 2 })).toBe('held');
		expect(packingStage({ ...none, heldAt: 5, shippedAt: 9 })).toBe('shipped');
	});
});
