<script lang="ts">
	import { resolve } from '$app/paths';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import { getAdminProduct, getProductOptions } from '../admin.remote';
	import ProductForm from './ProductForm.svelte';

	/** The product to edit; leave out for a new one. */
	let { id }: { id?: number } = $props();
</script>

<svelte:head><title>{id ? 'Edit product' : 'New product'} · Admin</title></svelte:head>

<Text><a href={resolve('/products')}>← Products</a></Text>
<Title class="mt-2 mb-6" level={1} size="md">{id ? 'Edit product' : 'New product'}</Title>

<Boundary message="Could not load the product." statusMessages={{ 404: 'Product not found.' }}>
	{let options = $derived(await getProductOptions())}
	{let product = $derived(id ? await getAdminProduct(id) : null)}
	{#key product?.id}
		<ProductForm {options} {product} />
	{/key}
	{#snippet pending()}
		<Text class="text-[var(--ink-muted)]">Loading…</Text>
	{/snippet}
</Boundary>
