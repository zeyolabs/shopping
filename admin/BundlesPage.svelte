<script lang="ts">
	import { resolve } from '$app/paths';
	import { getAdminBundles } from '../remote/admin-products.remote';
	import Badge from '@zeyolabs/ui/badge/Badge.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
</script>

<svelte:head><title>Bundles · Admin</title></svelte:head>

<p class="text-sm"><a href={resolve('/products')}>← Products</a></p>
<div class="mt-2 flex items-center justify-between">
	<h1 class="text-2xl font-semibold">Bundles</h1>
	<a
		class="rounded-md bg-[var(--leaf-dark)] px-3 py-1.5 text-sm text-white no-underline"
		href={resolve('/bundles/new')}>New bundle</a
	>
</div>
<p class="mt-1 text-sm text-[var(--ink-muted)]">
	A bundle is built in steps; the customer's picks go into the basket as ordinary products at their
	own prices. Use a Stripe promotion code for a bundle discount.
</p>

<Boundary message="Could not load bundles.">
	{let rows = $derived(await getAdminBundles())}
	<ul class="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-white">
		{#each rows as row (row.id)}
			<li class="px-4 py-2 text-sm">
				<a class="font-medium" href={resolve('/bundles/[id]', { id: String(row.id) })}>{row.name}</a
				>
				<span class="text-[var(--ink-muted)]">/bundle/{row.slug}</span>
				{#if !row.active}<Badge color="neutral">inactive</Badge>{/if}
			</li>
		{:else}
			<li class="px-4 py-6 text-[var(--ink-muted)]">No bundles yet.</li>
		{/each}
	</ul>
	{#snippet pending()}
		<p class="mt-6 text-[var(--ink-muted)]">Loading…</p>
	{/snippet}
</Boundary>
