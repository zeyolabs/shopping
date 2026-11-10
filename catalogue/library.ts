/** Shop search terms. Pure. */
export const Search = {
	/** How many results a search returns. */
	LIMIT: 48,
	/** Longest query the shop accepts. */
	MAX_LENGTH: 100,

	/** A LIKE pattern matching `word` anywhere; `%` and `_` typed by a customer mean the characters. */
	pattern(word: string): string {
		return `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
	},

	/** The words of a query, lower-cased, at most 6 (each must match). */
	words(query: string): string[] {
		return query
			.toLowerCase()
			.slice(0, Search.MAX_LENGTH)
			.split(/\s+/)
			.filter((w) => w.length > 0)
			.slice(0, 6);
	},
};
