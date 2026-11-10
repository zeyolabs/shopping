<script lang="ts">
	import { resolve } from '$app/paths';
	import { getAdminBundle } from '../admin.remote';
	import BundleForm from './BundleForm.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';

	/** The bundle to edit; leave out for a new one. */
	let { id }: { id?: number } = $props();
</script>

<svelte:head><title>{id ? 'Edit bundle' : 'New bundle'} · Admin</title></svelte:head>

<p class="text-sm"><a href={resolve('/bundles')}>← Bundles</a></p>
<h1 class="mt-2 mb-6 text-2xl font-semibold">{id ? 'Edit bundle' : 'New bundle'}</h1>

<Boundary message="Could not load the bundle." statusMessages={{ 404: 'Bundle not found.' }}>
	{let bundle = $derived(id ? await getAdminBundle(id) : null)}
	{#key bundle?.id}
		<BundleForm {bundle} />
	{/key}
	{#snippet pending()}
		<p class="text-[var(--ink-muted)]">Loading…</p>
	{/snippet}
</Boundary>
