/** D1 allows at most 100 bound parameters per statement; id lists are split below that. */
const SIZE = 90;

/** Splitting work over long id lists so each statement stays under D1's parameter limit. */
export const Batches = {
	SIZE,

	/** `list` in slices of at most `size`. */
	chunks<T>(list: readonly T[], size = SIZE): T[][] {
		const out: T[][] = [];
		for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
		return out;
	},

	/** Runs `query` once per slice of `ids` (one after another) and joins the rows. */
	async rows<T, R>(ids: readonly T[], query: (slice: T[]) => Promise<R[]>): Promise<R[]> {
		const out: R[] = [];
		for (const slice of Batches.chunks(ids)) out.push(...(await query(slice)));
		return out;
	},
};
