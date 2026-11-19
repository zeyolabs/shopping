<script lang="ts">
	import { page as current } from '$app/state';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';

	import { Paging } from '../catalogue/library';

	/** Links to the pages of a listing (`?page=N`), so every page is a real, crawlable URL. */
	let { page, pages }: { page: number; pages: number } = $props();

	const href = (n: number) =>
		n === 1 ? current.url.pathname : `${current.url.pathname}?page=${n}`;

	const box =
		'inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-full px-3 no-underline';
	const link = `${box} border border-[var(--bd)] text-[var(--tx)] hover:border-[var(--primary-strong)] hover:text-[var(--primary-strong)]`;
</script>

{#if pages > 1}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- same path as this page, only ?page changes -->
	<nav class="mt-10" aria-label="Pages">
		<Cluster gap="xs" justify="center">
			{#if page > 1}
				<a class={link} href={href(page - 1)} rel="prev">
					<ChevronLeft class="size-4" aria-hidden="true" /> Previous
				</a>
			{/if}
			{#each Paging.window(page, pages) as n, i (n ?? `gap-${i}`)}
				{#if n === null}
					<div class="{box} text-[var(--txt)]" aria-hidden="true">…</div>
				{:else if n === page}
					<div class="{box} bg-[var(--primary-strong)] text-white" aria-current="page">
						<Span bold>{n}</Span>
					</div>
				{:else}
					<a class={link} aria-label="Page {n}" href={href(n)}>{n}</a>
				{/if}
			{/each}
			{#if page < pages}
				<a class={link} href={href(page + 1)} rel="next">
					Next <ChevronRight class="size-4" aria-hidden="true" />
				</a>
			{/if}
		</Cluster>
	</nav>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{/if}
