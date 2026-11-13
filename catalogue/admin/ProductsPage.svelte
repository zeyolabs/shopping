<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getAdminProducts } from '../admin.remote';
	import { Money } from '../../utils/money';
	import Badge from '@zeyolabs/ui/badge/Badge.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';

	const q = $derived(page.url.searchParams.get('q') ?? '');
</script>

<svelte:head><title>Products · Admin</title></svelte:head>

<div class="flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-semibold">Products</h1>
	<div class="flex gap-2 text-sm">
		<a
			class="rounded-md border border-[var(--line)] bg-white px-3 py-1.5"
			href={resolve('/categories')}>Categories</a
		>
		<a
			class="rounded-md border border-[var(--line)] bg-white px-3 py-1.5"
			href={resolve('/bundles')}>Bundles</a
		>
		<a
			class="rounded-md bg-[var(--leaf-dark)] px-3 py-1.5 text-white no-underline"
			href={resolve('/products/new')}>New product</a
		>
	</div>
</div>

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
		class="w-full max-w-sm rounded-md border border-[var(--line)] bg-white px-3 py-1.5"
		placeholder="Name or SKU"
		type="search"
		value={q}
	/>
</form>

<Boundary message="Could not load products.">
	{let rows = $derived(await getAdminProducts(q))}
	<div class="mt-4 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-[var(--line)] text-[var(--ink-muted)]">
				<tr>
					<th class="px-4 py-2 font-medium">Product</th>
					<th class="px-4 py-2 font-medium">SKU</th>
					<th class="px-4 py-2 text-right font-medium">Price</th>
					<th class="px-4 py-2 text-right font-medium">Stock</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[var(--line)]">
				{#each rows as row (row.id)}
					<tr>
						<td class="px-4 py-2">
							<a class="font-medium" href={resolve('/products/[id]', { id: String(row.id) })}
								>{row.name}{row.variationLabel ? ` · ${row.variationLabel}` : ''}</a
							>
							{#if !row.active}<Badge color="neutral">inactive</Badge>{/if}
						</td>
						<td class="px-4 py-2 whitespace-nowrap">{row.sku}</td>
						<td class="px-4 py-2 text-right">{Money.format(row.pricePence)}</td>
						<td class="px-4 py-2 text-right">{row.stock}</td>
					</tr>
				{:else}
					<tr><td class="px-4 py-6 text-[var(--ink-muted)]" colspan="4">No products found.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#snippet pending()}
		<p class="mt-6 text-[var(--ink-muted)]">Loading…</p>
	{/snippet}
</Boundary>
