<script lang="ts">
	/** A read-only star rating, e.g. 4.5 shows as four and a half of five stars. */
	let { rating, size = 'text-base' }: { rating: number; size?: string } = $props();
	const pct = $derived(`${Math.max(0, Math.min(5, rating)) * 20}%`);
</script>

<!-- eslint-disable svelte/no-restricted-html-elements -- an inline glyph graphic, not text -->
<span
	class="relative inline-block leading-none {size}"
	aria-label="{rating} out of 5 stars"
	role="img"
>
	<span class="text-[var(--bd)]" aria-hidden="true">★★★★★</span>
	<span
		style:width={pct}
		class="absolute inset-0 overflow-hidden whitespace-nowrap text-[var(--primary-strong)]"
		aria-hidden="true">★★★★★</span
	>
</span>
<!-- eslint-enable svelte/no-restricted-html-elements -->
