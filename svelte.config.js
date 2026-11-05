// Tooling only (svelte-check and the editor look for the nearest config upward from each file).
// The apps compile these components with their own vite.config.ts options, which match this.
export default {
	compilerOptions: { experimental: { async: true } },
};
