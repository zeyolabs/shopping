<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import { Form } from '@zeyolabs/ui/form';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import { shopContext } from '../../context';
	import { REVIEW_STATUSES, type ReviewStatus } from '../../db/schema';
	import { getReviews, moderateReviewForm } from '../admin.remote';
	import { ModerateReviewSchema } from '../schema';

	const context = shopContext();
	const status = $derived.by((): ReviewStatus => {
		const value = page.url.searchParams.get('status');
		return REVIEW_STATUSES.find((s) => s === value) ?? 'pending';
	});
	const LABELS: Record<ReviewStatus, string> = {
		approved: 'Approved',
		pending: 'To check',
		rejected: 'Rejected',
	};
	const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Europe/London' });
</script>

<svelte:head><title>Reviews · Admin</title></svelte:head>

<Title level={1} size="md">Reviews</Title>
<Text class="mt-1" color="secondary">
	Customers review items from their order page. A review shows on the product page once approved.
</Text>

<nav class="mt-4 flex gap-2" aria-label="Review status">
	{#each REVIEW_STATUSES as s (s)}
		<a
			class="rounded-full border px-3 py-1 text-sm no-underline {s === status
				? 'border-[var(--acc)] bg-[var(--acc)] text-white'
				: 'border-[var(--bd)] bg-white text-[var(--tx)]'}"
			aria-current={s === status ? 'page' : undefined}
			href="{resolve('/reviews')}?status={s}">{LABELS[s]}</a
		>
	{/each}
</nav>

<Boundary message="Could not load reviews.">
	{let rows = $derived(await getReviews(status))}
	{#if rows.length === 0}
		<Text class="mt-6" color="secondary">Nothing here.</Text>
	{:else}
		<ul class="mt-4 space-y-4">
			{#each rows as review (review.id)}
				{const form = moderateReviewForm.for(review.id)}
				<li class="rounded-xl border border-[var(--bd)] bg-white p-4">
					<Text color="secondary">
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the shop's own domain -->
						<a href="{context.siteUrl}/product/{review.productSlug}" rel="noopener" target="_blank"
							>{review.productName}</a
						>
						· order
						<a href={resolve('/orders/[number]', { number: review.orderNumber })}
							>{review.orderNumber}</a
						>
						· {review.email} · {date.format(review.createdAt)}
					</Text>
					<Text class="mt-2">
						<!-- eslint-disable-next-line svelte/no-restricted-html-elements -- star glyphs with an aria-label, which Span does not take -->
						<span class="text-[var(--acc)]" aria-label="{review.rating} out of 5"
							>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span
						>
						{#if review.title}<strong class="ml-2">{review.title}</strong>{/if}
					</Text>
					<Text class="mt-2 whitespace-pre-line">{review.body}</Text>
					<Text class="mt-2">by {review.name}</Text>
					<Form
						class="mt-3 flex gap-2"
						{form}
						hidden={{ id: review.id }}
						reset={false}
						schema={ModerateReviewSchema}
					>
						{#if review.status !== 'approved'}
							<Button {...form.fields.status.as('submit', 'approved')} {form}>Approve</Button>
						{/if}
						{#if review.status !== 'rejected'}
							<Button {...form.fields.status.as('submit', 'rejected')} {form} variant="secondary"
								>Reject</Button
							>
						{/if}
					</Form>
				</li>
			{/each}
		</ul>
	{/if}
	{#snippet pending()}
		<Text class="mt-6" color="secondary">Loading…</Text>
	{/snippet}
</Boundary>
