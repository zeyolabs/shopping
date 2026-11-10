<script lang="ts">
	import { resolve } from '$app/paths';
	import { getAdminCategories } from '../admin.remote';
	import CategoryForm from './CategoryForm.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import Button from '@zeyolabs/ui/form/Button.svelte';

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

<p class="text-sm"><a href={resolve('/products')}>← Products</a></p>
<div class="mt-2 flex items-center justify-between">
	<h1 class="text-2xl font-semibold">Categories</h1>
	<Button onclick={() => (editing = null)}>New category</Button>
</div>

{#if editing !== undefined}
	{#key editing?.id ?? 'new'}
		<div class="mt-4"><CategoryForm category={editing} onDone={() => (editing = undefined)} /></div>
	{/key}
{/if}

<Boundary message="Could not load categories.">
	{let rows = $derived(await getAdminCategories())}
	<ul class="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-white">
		{#each rows as row (row.id)}
			<li class="flex items-center justify-between gap-3 px-4 py-2 text-sm">
				<span
					><strong>{row.name}</strong>
					<span class="text-[var(--ink-muted)]">/category/{row.slug} · {row.products} products</span
					></span
				>
				<button class="underline" onclick={() => (editing = row)} type="button">Edit</button>
			</li>
		{:else}
			<li class="px-4 py-6 text-[var(--ink-muted)]">No categories yet.</li>
		{/each}
	</ul>
	{#snippet pending()}
		<p class="mt-6 text-[var(--ink-muted)]">Loading…</p>
	{/snippet}
</Boundary>
