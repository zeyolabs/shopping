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

export type ProductParagraph = { heading: null | string; text: string };
export type ProductSpec = { label: string; value: string };

const SPEC_LINE = /^([A-Za-z][\w ()%./&-]{0,29}):\s+(\S.{0,59})$/;
const UNKNOWN_VALUE = /^(unknown|n\/a|none|-+)$/i;

/**
 * A product description is plain text. Blocks are separated by a blank line; a block whose lines
 * are all short `Label: value` pairs (two or more) is a spec list, and a short first line without
 * closing punctuation, followed by more lines, is that block's heading. Pure.
 */
export const ProductText = {
	/** Descriptions longer than this show their first paragraphs and fold the rest behind "Read more". */
	FOLD_AFTER_CHARS: 600,

	parse(description: string): { paragraphs: ProductParagraph[]; specs: ProductSpec[] } {
		const paragraphs: ProductParagraph[] = [];
		const specs: ProductSpec[] = [];
		const blocks = description
			.replace(/\r\n?/g, '\n')
			.split(/\n\s*\n/)
			.map((block) =>
				block
					.split('\n')
					.map((line) => line.trim())
					.filter(Boolean)
			)
			.filter((lines) => lines.length > 0);

		for (const lines of blocks) {
			const pairs = lines.map((line) => SPEC_LINE.exec(line));
			if (lines.length >= 2 && pairs.every(Boolean)) {
				for (const pair of pairs) {
					const value = pair![2].trim();
					if (!UNKNOWN_VALUE.test(value)) specs.push({ label: pair![1].trim(), value });
				}
				continue;
			}
			const [first, ...rest] = lines;
			const isHeading = rest.length > 0 && first.length <= 60 && !/[.!?:,;]$/.test(first);
			paragraphs.push(
				isHeading
					? { heading: first, text: rest.join('\n') }
					: { heading: null, text: lines.join('\n') }
			);
		}
		return { paragraphs, specs };
	},

	/** How many leading paragraphs to show before folding: at least one, then up to `FOLD_AFTER_CHARS`. */
	visibleCount(paragraphs: ProductParagraph[]): number {
		let chars = 0;
		for (const [i, p] of paragraphs.entries()) {
			chars += (p.heading?.length ?? 0) + p.text.length;
			if (chars > ProductText.FOLD_AFTER_CHARS) return Math.max(1, i);
		}
		return paragraphs.length;
	},
};
