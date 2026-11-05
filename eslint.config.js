import { base, config } from '@zeyolabs/kit/eslint-config';

export default config(...base(), {
	languageOptions: {
		parserOptions: {
			tsconfigRootDir: import.meta.dirname,
		},
	},
});
