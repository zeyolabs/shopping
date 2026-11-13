/** Product images: the database stores only file names. */
export const Images = {
	/** A product image's URL; `base` is the config's `imageBaseUrl`. */
	url(base: string, file: string): string {
		return `${base}/${file}`;
	},
};
