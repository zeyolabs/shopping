/** A product image's URL. The database stores only the file name; `base` is the config's `imageBaseUrl`. */
export const productImageUrl = (base: string, file: string): string => `${base}/${file}`;
