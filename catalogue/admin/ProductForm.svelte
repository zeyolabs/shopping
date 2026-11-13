<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { getAdminProduct, getProductOptions } from '../admin.remote';
	import { saveProductForm } from '../admin.remote';
	import { shopContext } from '../../context';
	import { Images } from '../../utils/images';
	import { FormInput } from '../../utils/form-input';
	import { ProductFormSchema } from '../schema';
	import { CheckboxField, Form, MessageField, NumberField, TextField } from '@zeyolabs/ui/form';
	import Button from '@zeyolabs/ui/form/Button.svelte';

	type Product = Awaited<ReturnType<typeof getAdminProduct>>;
	type Options = Awaited<ReturnType<typeof getProductOptions>>;

	let { options, product }: { options: Options; product: null | Product } = $props();

	const context = shopContext();
	// The page re-creates this component per product ({#key}), so reading the prop once is right.
	// svelte-ignore state_referenced_locally
	const p = product;
	const form = saveProductForm.for(p?.id ?? 'new');
	const { components, images } = form.fields;

	const imageRows = $derived(images.value() ?? []);
	const componentRows = $derived(components.value() ?? []);
	const slug = $derived(form.fields.slug.value() ?? '');

	/** Swaps row `i` with the one above it. */
	function up<T>(rows: T[], i: number): T[] {
		if (i === 0) return rows;
		const next = [...rows];
		[next[i - 1], next[i]] = [next[i], next[i - 1]];
		return next;
	}

	const input = 'w-full rounded-md border border-[var(--line)] bg-white px-3 py-1.5';
	const section = 'grid gap-4 rounded-xl border border-[var(--line)] bg-white p-5';
</script>

<Form
	class="grid max-w-3xl gap-6"
	defaults={{
		active: p?.active ?? false,
		categoryIds: p?.categoryIds.map(String) ?? [],
		comparePrice: FormInput.penceToPounds(p?.comparePricePence),
		components: p?.components ?? [],
		description: p?.description ?? '',
		images: p?.images ?? [],
		lowStockThreshold: p?.lowStockThreshold ?? undefined,
		massGrams: p?.massGrams ?? 0,
		maxPerOrder: p?.maxPerOrder ?? 10,
		name: p?.name ?? '',
		packSize: p?.packSize ?? 1,
		price: FormInput.penceToPounds(p?.pricePence),
		shortDescription: p?.shortDescription ?? '',
		sku: p?.sku ?? '',
		slug: p?.slug ?? '',
		sortOrder: p?.sortOrder ?? 0,
		variationGroup: p?.variationGroup ?? '',
		variationLabel: p?.variationLabel ?? '',
	}}
	{form}
	hidden={{ id: p?.id }}
	onSuccess={(data) => {
		if (!p) goto(resolve('/products/[id]', { id: String(data.id) }));
	}}
	reset={false}
	schema={ProductFormSchema}
>
	<section class={section}>
		<h2 class="font-semibold">Basics</h2>
		<TextField name="name" {form}>Name</TextField>
		<div class="grid gap-4 sm:grid-cols-2">
			<TextField name="slug" {form} optional placeholder="made from the name">Slug (URL)</TextField>
			<TextField name="sku" {form}>SKU</TextField>
			<TextField name="price" {form} inputmode="decimal">Price (£)</TextField>
			<TextField name="comparePrice" {form} inputmode="decimal" optional>Was price (£)</TextField>
		</div>
		<CheckboxField name="active" {form}>On sale in the shop</CheckboxField>
		{#if p && slug && p.slug !== slug}
			<p class="text-sm text-[var(--ink-muted)]">
				The old URL /product/{p.slug} will redirect to the new one.
			</p>
		{/if}
	</section>

	<section class={section}>
		<h2 class="font-semibold">Description</h2>
		<TextField name="shortDescription" {form} optional>
			Short description (search results, top of the page)
		</TextField>
		<MessageField name="description" defaultHeight={200} {form} optional
			>Full description</MessageField
		>
	</section>

	<section class={section}>
		<div>
			<h2 class="font-semibold">Images</h2>
			<p class="text-sm text-[var(--ink-muted)]">
				File names in the product image bucket. The first is the cover.
			</p>
		</div>
		<ul class="space-y-3">
			{#each imageRows as row, i (i)}
				<li class="flex flex-wrap items-center gap-3">
					{#if row.src}
						<img
							class="size-14 rounded-md border border-[var(--line)] object-cover"
							alt=""
							src={Images.url(context.imageBaseUrl, row.src)}
						/>
					{/if}
					<input
						{...images[i].src.as('text')}
						class="{input} w-56"
						aria-label="Image {i + 1} file name"
						placeholder="file.avif"
					/>
					<input
						{...images[i].alt.as('text')}
						class="{input} flex-1"
						aria-label="Image {i + 1} alt text"
						placeholder="Alt text"
					/>
					<Button onclick={() => images.set(up(imageRows, i))} size="sm" variant="secondary"
						>Up</Button
					>
					<Button
						onclick={() => images.set(imageRows.filter((_, j) => j !== i))}
						size="sm"
						variant="secondary">Remove</Button
					>
				</li>
			{/each}
		</ul>
		<div>
			<Button onclick={() => images.set([...imageRows, { alt: '', src: '' }])} variant="secondary"
				>Add image</Button
			>
		</div>
	</section>

	<section class={section}>
		<h2 class="font-semibold">Categories</h2>
		<div class="grid gap-2 sm:grid-cols-2">
			{#each options.categories as category (category.id)}
				<label class="flex items-center gap-2 text-sm">
					<input {...form.fields.categoryIds.as('checkbox', String(category.id))} />
					{category.name}
				</label>
			{:else}
				<p class="text-sm text-[var(--ink-muted)]">No categories yet.</p>
			{/each}
		</div>
	</section>

	<section class={section}>
		<div>
			<h2 class="font-semibold">Variation</h2>
			<p class="text-sm text-[var(--ink-muted)]">
				Products in the same group show as options of each other, e.g. group "Colour", option
				"Black".
			</p>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<label class="text-sm font-medium">
				Group
				<input
					{...form.fields.variationGroup.as('text')}
					class="{input} mt-1"
					list="variation-groups"
				/>
			</label>
			<datalist id="variation-groups">
				{#each options.variationGroups as group (group)}<option value={group}></option>{/each}
			</datalist>
			<TextField name="variationLabel" {form} optional>This option</TextField>
		</div>
	</section>

	<section class={section}>
		<div>
			<h2 class="font-semibold">Stock and shipping</h2>
			<p class="text-sm text-[var(--ink-muted)]">
				Stock itself is set on the Stock page{p ? ` (now ${p.stock} units)` : ''}.
			</p>
		</div>
		<div class="grid gap-4 sm:grid-cols-3">
			<NumberField name="massGrams" {form} inputmode="numeric">Weight (g)</NumberField>
			<NumberField name="maxPerOrder" {form} inputmode="numeric">Max per order</NumberField>
			<NumberField name="packSize" {form} inputmode="numeric">Pack size (units)</NumberField>
			<NumberField name="lowStockThreshold" {form} inputmode="numeric" optional placeholder="never">
				"Only N left" from
			</NumberField>
			<NumberField name="sortOrder" {form} inputmode="numeric">Sort order</NumberField>
		</div>
	</section>

	<section class={section}>
		<div>
			<h2 class="font-semibold">Made of other products</h2>
			<p class="text-sm text-[var(--ink-muted)]">
				Leave empty for a normal product. A combined product has no stock of its own: it sells as
				many complete sets as its parts allow, and selling one takes stock from the parts.
			</p>
		</div>
		<ul class="space-y-2">
			{#each componentRows as _, i (i)}
				<li class="flex items-center gap-3">
					<input
						{...components[i].sku.as('text')}
						class="{input} w-56"
						aria-label="Part {i + 1} SKU"
						placeholder="SKU"
					/>
					<input
						{...components[i].quantity.as('number')}
						class="{input} w-24"
						aria-label="Part {i + 1} quantity"
						min="1"
					/>
					<Button
						onclick={() => components.set(componentRows.filter((_, j) => j !== i))}
						size="sm"
						variant="secondary">Remove</Button
					>
				</li>
			{/each}
		</ul>
		{#if componentRows.length < 10}
			<div>
				<Button
					onclick={() => components.set([...componentRows, { quantity: 1, sku: '' }])}
					variant="secondary">Add part</Button
				>
			</div>
		{/if}
	</section>

	<div class="flex items-center gap-4">
		<Button {form} loadingMessage="Saving…">Save product</Button>
		{#if p?.active}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the shop's own domain -->
			<a href="{context.siteUrl}/product/{p.slug}" rel="noopener" target="_blank">View in shop</a>
		{/if}
	</div>
</Form>
