<script lang="ts">
	import { resolve } from '$app/paths';
	import { getAdminCategories, saveCategoryCmd } from '../admin.remote';
	import { CategoryInputSchema } from '../schema';
	import { FormInput } from '../../utils/form-input';
	import { toast } from 'svelte-sonner';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import Button from '@zeyolabs/ui/form/Button.svelte';

	type Draft = { description: string; id?: number; name: string; slug: string; sortOrder: number };

	let editing = $state<Draft | null>(null);
	let saving = $state(false);

	async function save(event?: SubmitEvent) {
		event?.preventDefault();
		if (!editing) return;
		const parsed = CategoryInputSchema.safeParse({
			...editing,
			slug: editing.slug || FormInput.slugify(editing.name),
		});
		if (!parsed.success) {
			toast.error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
			return;
		}
		saving = true;
		try {
			await saveCategoryCmd(parsed.data);
			toast.success('Category saved.');
			editing = null;
		} catch (err) {
			toast.error((err as { body?: { message?: string } })?.body?.message ?? 'Could not save.');
		} finally {
			saving = false;
		}
	}

	const input = 'mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-1.5';
</script>

<svelte:head><title>Categories · Admin</title></svelte:head>

<p class="text-sm"><a href={resolve('/products')}>← Products</a></p>
<div class="mt-2 flex items-center justify-between">
	<h1 class="text-2xl font-semibold">Categories</h1>
	<Button onclick={() => (editing = { description: '', name: '', slug: '', sortOrder: 0 })}
		>New category</Button
	>
</div>

{#if editing}
	<form
		class="mt-4 grid max-w-xl gap-3 rounded-xl border border-[var(--line)] bg-white p-5"
		onsubmit={save}
	>
		<label class="text-sm font-medium">Name<input class={input} bind:value={editing.name} /></label>
		<label class="text-sm font-medium"
			>Slug (URL, blank to make one)<input class={input} bind:value={editing.slug} /></label
		>
		<label class="text-sm font-medium"
			>Description<textarea class="{input} min-h-24" bind:value={editing.description}
			></textarea></label
		>
		<label class="text-sm font-medium"
			>Sort order<input class={input} type="number" bind:value={editing.sortOrder} /></label
		>
		<div class="flex gap-3">
			<Button disabled={saving} onclick={() => save()}>Save</Button>
			<Button onclick={() => (editing = null)} variant="secondary">Cancel</Button>
		</div>
	</form>
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
				<button
					class="underline"
					onclick={() =>
						(editing = {
							description: row.description,
							id: row.id,
							name: row.name,
							slug: row.slug,
							sortOrder: row.sortOrder,
						})}
					type="button">Edit</button
				>
			</li>
		{:else}
			<li class="px-4 py-6 text-[var(--ink-muted)]">No categories yet.</li>
		{/each}
	</ul>
	{#snippet pending()}
		<p class="mt-6 text-[var(--ink-muted)]">Loading…</p>
	{/snippet}
</Boundary>
