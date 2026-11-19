<script lang="ts">
	/** A read-only star rating, e.g. 4.5 shows as four and a half of five stars. */
	let { rating, size = 'md' }: { rating: number; size?: 'md' | 'sm' } = $props();
	const pct = $derived(`${Math.max(0, Math.min(5, rating)) * 20}%`);
</script>

<div
	style:font-size={size === 'sm' ? '14px' : '16px'}
	style:line-height="1"
	class="relative inline-block whitespace-nowrap"
	aria-label="{rating} out of 5 stars"
	role="img"
>
	<div class="text-[var(--bd)]" aria-hidden="true">★★★★★</div>
	<div
		style:width={pct}
		class="absolute inset-0 overflow-hidden text-[var(--primary-strong)]"
		aria-hidden="true"
	>
		★★★★★
	</div>
</div>
