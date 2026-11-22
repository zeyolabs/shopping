<script lang="ts">
	import { resolve } from '$app/paths';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import Head from '@zeyolabs/ui/head/Head.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import { getAdminBundle } from '../admin.remote';
	import BundleForm from './BundleForm.svelte';

	/** The bundle to edit; leave out for a new one. */
	let { id }: { id?: number } = $props();
</script>

<Head title={id ? 'Edit bundle' : 'New bundle'} />

<Text><a href={resolve('/bundles')}>← Bundles</a></Text>
<Title class="mt-2 mb-6" level={1} size="md">{id ? 'Edit bundle' : 'New bundle'}</Title>

<Boundary message="Could not load the bundle." statusMessages={{ 404: 'Bundle not found.' }}>
	{let bundle = $derived(id ? await getAdminBundle(id) : null)}
	{#key bundle?.id}
		<BundleForm {bundle} />
	{/key}
	{#snippet pending()}
		<Text color="secondary">Loading…</Text>
	{/snippet}
</Boundary>
