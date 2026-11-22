<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '@zeyolabs/ui/badge/Badge.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import Head from '@zeyolabs/ui/head/Head.svelte';
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import { getAdminBundles } from '../admin.remote';
</script>

<Head title="Bundles" />

<Text><a href={resolve('/products')}>← Products</a></Text>
<Cluster class="mt-2" gap="sm" justify="between">
	<Title level={1} size="md">Bundles</Title>
	<Button href={resolve('/bundles/new')}>New bundle</Button>
</Cluster>
<Text class="mt-1" color="secondary">
	A bundle is built in steps; the customer's picks go into the basket as ordinary products at their
	own prices. Use a Stripe promotion code for a bundle discount.
</Text>

<Boundary message="Could not load bundles.">
	{let rows = $derived(await getAdminBundles())}
	<ul class="mt-4 divide-y divide-[var(--bd)] rounded-xl border border-[var(--bd)] bg-white">
		{#each rows as row (row.id)}
			<li class="px-4 py-2">
				<a href={resolve('/bundles/[id]', { id: String(row.id) })}
					><Span bold size="sm">{row.name}</Span></a
				>
				<Span color="secondary" size="sm">/bundle/{row.slug}</Span>
				{#if !row.active}<Badge color="neutral">inactive</Badge>{/if}
			</li>
		{:else}
			<li class="px-4 py-6"><Text color="secondary">No bundles yet.</Text></li>
		{/each}
	</ul>
	{#snippet pending()}
		<Text class="mt-6" color="secondary">Loading…</Text>
	{/snippet}
</Boundary>
