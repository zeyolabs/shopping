<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Badge from '@zeyolabs/ui/badge/Badge.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import { Money } from '../../utils/money';
	import { getAdminProducts } from '../admin.remote';

	const q = $derived(page.url.searchParams.get('q') ?? '');
</script>

<svelte:head><title>Products · Admin</title></svelte:head>

<Cluster gap="sm" justify="between">
	<Title level={1} size="md">Products</Title>
	<Cluster gap="xs">
		<Button href={resolve('/categories')} variant="secondary">Categories</Button>
		<Button href={resolve('/bundles')} variant="secondary">Bundles</Button>
		<Button href={resolve('/products/new')}>New product</Button>
	</Cluster>
</Cluster>

<form
	class="mt-4"
	onsubmit={(event) => {
		event.preventDefault();
		const value = String(new FormData(event.currentTarget).get('q') ?? '').trim();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved path plus query
		goto(`${resolve('/products')}${value ? `?q=${encodeURIComponent(value)}` : ''}`);
	}}
	role="search"
>
	<label class="sr-only" for="product-q">Find a product</label>
	<input
		id="product-q"
		name="q"
		class="w-full max-w-sm rounded-md border border-[var(--bd)] bg-white px-3 py-1.5"
		placeholder="Name or SKU"
		type="search"
		value={q}
	/>
</form>

<Boundary message="Could not load products.">
	{let rows = $derived(await getAdminProducts(q))}
	<div class="mt-4 overflow-x-auto rounded-xl border border-[var(--bd)] bg-white">
		<table class="w-full text-left">
			<thead class="border-b border-[var(--bd)] text-[var(--txs)]">
				<tr>
					<th class="px-4 py-2"><Span bold size="sm">Product</Span></th>
					<th class="px-4 py-2"><Span bold size="sm">SKU</Span></th>
					<th class="px-4 py-2 text-right"><Span bold size="sm">Price</Span></th>
					<th class="px-4 py-2 text-right"><Span bold size="sm">Stock</Span></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[var(--bd)]">
				{#each rows as row (row.id)}
					<tr>
						<td class="px-4 py-2">
							<a href={resolve('/products/[id]', { id: String(row.id) })}
								><Span bold size="sm"
									>{row.name}{row.variationLabel ? ` · ${row.variationLabel}` : ''}</Span
								></a
							>
							{#if !row.active}<Badge color="neutral">inactive</Badge>{/if}
						</td>
						<td class="px-4 py-2 whitespace-nowrap"><Span size="sm">{row.sku}</Span></td>
						<td class="px-4 py-2 text-right"
							><Span size="sm">{Money.format(row.pricePence)}</Span></td
						>
						<td class="px-4 py-2 text-right"><Span size="sm">{row.stock}</Span></td>
					</tr>
				{:else}
					<tr
						><td class="px-4 py-6" colspan="4"><Text color="secondary">No products found.</Text></td
						></tr
					>
				{/each}
			</tbody>
		</table>
	</div>
	{#snippet pending()}
		<Text class="mt-6" color="secondary">Loading…</Text>
	{/snippet}
</Boundary>
