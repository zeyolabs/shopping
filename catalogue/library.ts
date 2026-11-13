/** Shop search terms. Pure. */
export const Search = {
	/** How many results a search returns. */
	LIMIT: 48,
	/** Longest query the shop accepts. */
	MAX_LENGTH: 100,
	/** D1 rejects a LIKE pattern over 50 bytes; this leaves room for the two `%`. */
	MAX_WORD_BYTES: 48,

	/** A LIKE pattern matching `word` anywhere; `%` and `_` typed by a customer mean the characters. */
	pattern(word: string): string {
		return `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
	},

	/** The words of a query, lower-cased, at most 6 (each must match), each short enough for D1's LIKE limit. */
	words(query: string): string[] {
		return query
			.toLowerCase()
			.slice(0, Search.MAX_LENGTH)
			.split(/\s+/)
			.filter((w) => w.length > 0)
			.slice(0, 6)
			.map(fitPattern);
	},
};

/** `word` cut so that its escaped LIKE pattern, `%` and `%` included, is at most 50 UTF-8 bytes. */
function fitPattern(word: string): string {
	const encoder = new TextEncoder();
	let bytes = 0;
	let fitted = '';
	for (const char of word) {
		bytes += encoder.encode(Search.pattern(char).slice(1, -1)).length;
		if (bytes > Search.MAX_WORD_BYTES) break;
		fitted += char;
	}
	return fitted;
}
