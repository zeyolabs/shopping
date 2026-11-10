<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { getAdminProduct, getProductOptions } from '../admin.remote';
	import { saveProductCmd } from '../admin.remote';
	import { shopContext } from '../../context';
	import { Images } from '../../utils/images';
	import { ProductInputSchema } from '../schema';
	import { FormInput } from '../../utils/form-input';
	import { toast } from 'svelte-sonner';
	import Button from '@zeyolabs/ui/form/Button.svelte';

	type Product = Awaited<ReturnType<typeof getAdminProduct>>;
	type Options = Awaited<ReturnType<typeof getProductOptions>>;

	let { options, product }: { options: Options; product: null | Product } = $props();

	const context = shopContext();
	const p = product;

	let name = $state(p?.name ?? '');
	let slug = $state(p?.slug ?? '');
	let slugTouched = $state(p !== null);
	let sku = $state(p?.sku ?? '');
	let active = $state(p?.active ?? false);
	let price = $state(FormInput.penceToPounds(p?.pricePence));
	let comparePrice = $state(FormInput.penceToPounds(p?.comparePricePence));
	let shortDescription = $state(p?.shortDescription ?? '');
	let description = $state(p?.description ?? '');
	let massGrams = $state(p?.massGrams ?? 0);
	let maxPerOrder = $state(p?.maxPerOrder ?? 10);
	let packSize = $state(p?.packSize ?? 1);
	let lowStockThreshold = $state<null | number>(p?.lowStockThreshold ?? null);
	let sortOrder = $state(p?.sortOrder ?? 0);
	let categoryIds = $state<number[]>(p?.categoryIds ?? []);
	let variationGroup = $state(p?.variationGroup ?? '');
	let variationLabel = $state(p?.variationLabel ?? '');
	let images = $state<{ alt: string; src: string }[]>(p?.images ?? []);
	let components = $state<{ quantity: number; sku: string }[]>(p?.components ?? []);
	let saving = $state(false);
	let errors = $state<string[]>([]);

	$effect(() => {
		if (!slugTouched) slug = FormInput.slugify(name);
	});

	function move<T>(list: T[], i: number, by: number): T[] {
		const next = [...list];
		const j = i + by;
		if (j < 0 || j >= next.length) return next;
		[next[i], next[j]] = [next[j], next[i]];
		return next;
	}

	async function save(event?: SubmitEvent) {
		event?.preventDefault();
		errors = [];
		const pricePence = FormInput.parsePounds(price);
		const comparePricePence = FormInput.parsePounds(comparePrice);
		if (pricePence === null || Number.isNaN(pricePence)) errors.push('Price: enter e.g. 12.50');
		if (comparePricePence !== null && Number.isNaN(comparePricePence))
			errors.push('Was price: enter e.g. 15.00 or leave blank');
		const parsed = ProductInputSchema.safeParse({
			active,
			categoryIds,
			comparePricePence,
			components: components.filter((c) => c.sku.trim() !== ''),
			description,
			id: p?.id,
			images: images.filter((i) => i.src.trim() !== ''),
			lowStockThreshold:
				lowStockThreshold === null || Number.isNaN(lowStockThreshold) ? null : lowStockThreshold,
			massGrams,
			maxPerOrder,
			name,
			packSize,
			pricePence,
			shortDescription,
			sku,
			slug,
			sortOrder,
			variationGroup: variationGroup.trim() || null,
			variationLabel: variationLabel.trim() || null,
		});
		if (!parsed.success) {
			errors.push(
				...parsed.error.issues.map((issue) => `${issue.path.join('.') || 'Form'}: ${issue.message}`)
			);
		}
		if (errors.length > 0 || !parsed.success) return;
		saving = true;
		try {
			const { id } = await saveProductCmd(parsed.data);
			toast.success('Product saved.');
			if (!p) await goto(resolve('/products/[id]', { id: String(id) }));
		} catch (err) {
			const message = (err as { body?: { message?: string } })?.body?.message;
			toast.error(message ?? 'Could not save the product.');
		} finally {
			saving = false;
		}
	}

	const input = 'mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-1.5';
	const label = 'block text-sm font-medium';
	const section = 'rounded-xl border border-[var(--line)] bg-white p-5';
</script>

<form class="grid max-w-3xl gap-6" novalidate onsubmit={save}>
	{#if errors.length > 0}
		<ul class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
			{#each errors as error (error)}<li>{error}</li>{/each}
		</ul>
	{/if}

	<section class={section}>
		<h2 class="font-semibold">Basics</h2>
		<div class="mt-3 grid gap-4 sm:grid-cols-2">
			<label class="{label} sm:col-span-2"
				>Name<input class={input} bind:value={name} required /></label
			>
			<label class={label}
				>Slug (URL)<input
					class={input}
					oninput={() => (slugTouched = true)}
					bind:value={slug}
					required
				/></label
			>
			<label class={label}>SKU<input class={input} bind:value={sku} required /></label>
			<label class={label}
				>Price (£)<input class={input} inputmode="decimal" bind:value={price} required /></label
			>
			<label class={label}
				>Was price (£, optional)<input
					class={input}
					inputmode="decimal"
					bind:value={comparePrice}
				/></label
			>
			<label class="flex items-center gap-2 text-sm font-medium sm:col-span-2">
				<input type="checkbox" bind:checked={active} /> On sale in the shop
			</label>
		</div>
		{#if p && p.slug !== slug}
			<p class="mt-2 text-sm text-[var(--ink-muted)]">
				The old URL /product/{p.slug} will redirect to the new one.
			</p>
		{/if}
	</section>

	<section class={section}>
		<h2 class="font-semibold">Description</h2>
		<label class="{label} mt-3"
			>Short description (search results, top of the page)<input
				class={input}
				bind:value={shortDescription}
				maxlength="500"
			/></label
		>
		<label class="{label} mt-3"
			>Full description<textarea class="{input} min-h-48" bind:value={description}
			></textarea></label
		>
	</section>

	<section class={section}>
		<h2 class="font-semibold">Images</h2>
		<p class="mt-1 text-sm text-[var(--ink-muted)]">
			File names in the product image bucket. The first is the cover.
		</p>
		<ul class="mt-3 space-y-3">
			{#each images as image, i (i)}
				<li class="flex flex-wrap items-center gap-3">
					{#if image.src}
						<img
							class="size-14 rounded-md border border-[var(--line)] object-cover"
							alt=""
							src={Images.url(context.imageBaseUrl, image.src)}
						/>
					{/if}
					<input
						class="{input} mt-0 w-56"
						aria-label="File name"
						placeholder="file.avif"
						bind:value={image.src}
					/>
					<input
						class="{input} mt-0 flex-1"
						aria-label="Alt text"
						placeholder="Alt text"
						bind:value={image.alt}
					/>
					<button
						class="text-sm underline"
						onclick={() => (images = move(images, i, -1))}
						type="button">Up</button
					>
					<button
						class="text-sm underline"
						onclick={() => (images = images.filter((_, j) => j !== i))}
						type="button">Remove</button
					>
				</li>
			{/each}
		</ul>
		<button
			class="mt-3 text-sm underline"
			onclick={() => (images = [...images, { alt: '', src: '' }])}
			type="button">Add image</button
		>
	</section>

	<section class={section}>
		<h2 class="font-semibold">Categories</h2>
		<div class="mt-3 grid gap-2 sm:grid-cols-2">
			{#each options.categories as category (category.id)}
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" value={category.id} bind:group={categoryIds} />
					{category.name}
				</label>
			{:else}
				<p class="text-sm text-[var(--ink-muted)]">No categories yet.</p>
			{/each}
		</div>
	</section>

	<section class={section}>
		<h2 class="font-semibold">Variation</h2>
		<p class="mt-1 text-sm text-[var(--ink-muted)]">
			Products in the same group show as options of each other, e.g. group "Colour", option "Black".
		</p>
		<div class="mt-3 grid gap-4 sm:grid-cols-2">
			<label class={label}
				>Group<input class={input} list="variation-groups" bind:value={variationGroup} /></label
			>
			<datalist id="variation-groups">
				{#each options.variationGroups as group (group)}<option value={group}></option>{/each}
			</datalist>
			<label class={label}>This option<input class={input} bind:value={variationLabel} /></label>
		</div>
	</section>

	<section class={section}>
		<h2 class="font-semibold">Stock and shipping</h2>
		<p class="mt-1 text-sm text-[var(--ink-muted)]">
			Stock itself is set on the Stock page{p ? ` (now ${p.stock} units)` : ''}.
		</p>
		<div class="mt-3 grid gap-4 sm:grid-cols-3">
			<label class={label}
				>Weight (g)<input class={input} min="0" type="number" bind:value={massGrams} /></label
			>
			<label class={label}
				>Max per order<input
					class={input}
					min="1"
					max="99"
					type="number"
					bind:value={maxPerOrder}
				/></label
			>
			<label class={label}
				>Pack size (units)<input class={input} min="1" type="number" bind:value={packSize} /></label
			>
			<label class={label}
				>"Only N left" from<input
					class={input}
					min="0"
					placeholder="never"
					type="number"
					bind:value={lowStockThreshold}
				/></label
			>
			<label class={label}
				>Sort order<input class={input} type="number" bind:value={sortOrder} /></label
			>
		</div>
	</section>

	<section class={section}>
		<h2 class="font-semibold">Made of other products</h2>
		<p class="mt-1 text-sm text-[var(--ink-muted)]">
			Leave empty for a normal product. A combined product has no stock of its own: it sells as many
			complete sets as its parts allow, and selling one takes stock from the parts.
		</p>
		<ul class="mt-3 space-y-2">
			{#each components as component, i (i)}
				<li class="flex items-center gap-3">
					<input
						class="{input} mt-0 w-56"
						aria-label="Part SKU"
						placeholder="SKU"
						bind:value={component.sku}
					/>
					<input
						class="{input} mt-0 w-24"
						aria-label="Quantity"
						min="1"
						type="number"
						bind:value={component.quantity}
					/>
					<button
						class="text-sm underline"
						onclick={() => (components = components.filter((_, j) => j !== i))}
						type="button">Remove</button
					>
				</li>
			{/each}
		</ul>
		{#if components.length < 10}
			<button
				class="mt-3 text-sm underline"
				onclick={() => (components = [...components, { quantity: 1, sku: '' }])}
				type="button">Add part</button
			>
		{/if}
	</section>

	<div class="flex items-center gap-4">
		<Button disabled={saving} onclick={() => save()}>{saving ? 'Saving…' : 'Save product'}</Button>
		{#if p && p.active}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the shop's own domain -->
			<a href="{context.siteUrl}/product/{p.slug}" rel="noopener" target="_blank">View in shop</a>
		{/if}
	</div>
</form>
