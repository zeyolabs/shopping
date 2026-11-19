<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '@zeyolabs/ui/badge/Badge.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import { getAdminBundles } from '../admin.remote';
</script>

<svelte:head><title>Bundles · Admin</title></svelte:head>

<Text><a href={resolve('/products')}>← Products</a></Text>
<div class="mt-2 flex items-center justify-between">
	<Title level={1} size="md">Bundles</Title>
	<a
		class="rounded-md bg-[var(--acc)] px-3 py-1.5 text-sm text-white no-underline"
		href={resolve('/bundles/new')}>New bundle</a
	>
</div>
<Text class="mt-1" color="secondary">
	A bundle is built in steps; the customer's picks go into the basket as ordinary products at their
	own prices. Use a Stripe promotion code for a bundle discount.
</Text>

<Boundary message="Could not load bundles.">
	{let rows = $derived(await getAdminBundles())}
	<ul class="mt-4 divide-y divide-[var(--bd)] rounded-xl border border-[var(--bd)] bg-white">
		{#each rows as row (row.id)}
			<li class="px-4 py-2 text-sm">
				<a class="font-medium" href={resolve('/bundles/[id]', { id: String(row.id) })}>{row.name}</a
				>
				<Span color="secondary">/bundle/{row.slug}</Span>
				{#if !row.active}<Badge color="neutral">inactive</Badge>{/if}
			</li>
		{:else}
			<li class="px-4 py-6 text-[var(--txs)]">No bundles yet.</li>
		{/each}
	</ul>
	{#snippet pending()}
		<Text class="mt-6" color="secondary">Loading…</Text>
	{/snippet}
</Boundary>
