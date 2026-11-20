<script lang="ts">
	import { resolve } from '$app/paths';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import { getAdminCategories } from '../admin.remote';
	import CategoryForm from './CategoryForm.svelte';

	type Category = {
		description: string;
		id: number;
		name: string;
		slug: string;
		sortOrder: number;
	};

	/** The category open in the editor: a row, `null` for a new one, `undefined` when closed. */
	let editing = $state<Category | null | undefined>(undefined);
</script>

<svelte:head><title>Categories · Admin</title></svelte:head>

<Text><a href={resolve('/products')}>← Products</a></Text>
<div class="mt-2 flex items-center justify-between">
	<Title level={1} size="md">Categories</Title>
	<Button onclick={() => (editing = null)}>New category</Button>
</div>

{#if editing !== undefined}
	{#key editing?.id ?? 'new'}
		<div class="mt-4"><CategoryForm category={editing} onDone={() => (editing = undefined)} /></div>
	{/key}
{/if}

<Boundary message="Could not load categories.">
	{let rows = $derived(await getAdminCategories())}
	<ul class="mt-4 divide-y divide-[var(--bd)] rounded-xl border border-[var(--bd)] bg-white">
		{#each rows as row (row.id)}
			<li class="px-4 py-2">
				<Cluster gap="sm" justify="between">
					<Span
						><Span bold size="sm">{row.name}</Span>
						<Span color="secondary" size="sm">/category/{row.slug} · {row.products} products</Span
						></Span
					>
					<button class="underline" onclick={() => (editing = row)} type="button"
						><Span size="sm">Edit</Span></button
					>
				</Cluster>
			</li>
		{:else}
			<li class="px-4 py-6"><Text color="secondary">No categories yet.</Text></li>
		{/each}
	</ul>
	{#snippet pending()}
		<Text class="mt-6" color="secondary">Loading…</Text>
	{/snippet}
</Boundary>
