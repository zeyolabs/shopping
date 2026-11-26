<script lang="ts">
	import type { JsonLdNode } from './library';

	import { Seo } from './library';

	/** A schema.org document in the page's `<head>`. The JSON is escaped, so page text cannot close the tag. */
	let { data }: { data: JsonLdNode } = $props();

	const tag = $derived(`<script type="application/ld+json">${Seo.jsonLd(data)}<${'/'}script>`);
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- Seo.jsonLd escapes < > & and U+2028/9 -->
	{@html tag}
</svelte:head>
