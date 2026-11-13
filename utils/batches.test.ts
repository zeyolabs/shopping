import { describe, expect, it } from 'vitest';

import { Batches } from './batches';

describe('Batches', () => {
	it('splits into slices of at most 90', () => {
		const ids = Array.from({ length: 200 }, (_, i) => i);
		expect(Batches.chunks(ids).map((c) => c.length)).toEqual([90, 90, 20]);
		expect(Batches.chunks([])).toEqual([]);
	});

	it('joins the rows of each slice', async () => {
		const ids = Array.from({ length: 181 }, (_, i) => i);
		const rows = await Batches.rows(ids, async (slice) => slice.map((id) => id * 2));
		expect(rows).toHaveLength(181);
		expect(rows.at(-1)).toBe(360);
	});
});
