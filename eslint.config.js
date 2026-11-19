import { base, config, svelteRules } from '@zeyolabs/kit/eslint-config';

import svelteConfig from './svelte.config.js';

export default config(...base(), ...svelteRules(svelteConfig, { uiText: true }), {
	languageOptions: {
		parserOptions: {
			tsconfigRootDir: import.meta.dirname,
		},
	},
});
