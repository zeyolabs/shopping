<script lang="ts">
	import { resolve } from '$app/paths';
	import { getAdminProduct, getProductOptions } from '../admin.remote';
	import ProductForm from './ProductForm.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';

	/** The product to edit; leave out for a new one. */
	let { id }: { id?: number } = $props();
</script>

<svelte:head><title>{id ? 'Edit product' : 'New product'} · Admin</title></svelte:head>

<p class="text-sm"><a href={resolve('/products')}>← Products</a></p>
<h1 class="mt-2 mb-6 text-2xl font-semibold">{id ? 'Edit product' : 'New product'}</h1>

<Boundary message="Could not load the product." statusMessages={{ 404: 'Product not found.' }}>
	{let options = $derived(await getProductOptions())}
	{let product = $derived(id ? await getAdminProduct(id) : null)}
	{#key product?.id}
		<ProductForm {options} {product} />
	{/key}
	{#snippet pending()}
		<p class="text-[var(--ink-muted)]">Loading…</p>
	{/snippet}
</Boundary>
