<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import { Form } from '@zeyolabs/ui/form';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import Head from '@zeyolabs/ui/head/Head.svelte';
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import { shopContext } from '../../context';
	import { REVIEW_STATUSES, type ReviewStatus } from '../../db/schema';
	import Stars from '../../ui/Stars.svelte';
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

<Head title="Reviews" />

<Title level={1} size="md">Reviews</Title>
<Text class="mt-1" color="secondary">
	Customers review items from their order page. A review shows on the product page once approved.
</Text>

<nav class="mt-4" aria-label="Review status">
	<Cluster gap="xs">
		{#each REVIEW_STATUSES as s (s)}
			<a
				class="rounded-full border px-3 py-1 no-underline {s === status
					? 'border-[var(--acc)] bg-[var(--acc)] text-white'
					: 'border-[var(--bd)] bg-white text-[var(--tx)]'}"
				aria-current={s === status ? 'page' : undefined}
				href="{resolve('/reviews')}?status={s}"><Span size="sm">{LABELS[s]}</Span></a
			>
		{/each}
	</Cluster>
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
						{#if review.orderNumber}
							· order
							<a href={resolve('/orders/[number]', { number: review.orderNumber })}
								>{review.orderNumber}</a
							>
							· {review.email}
						{:else}
							· imported
						{/if}
						· {date.format(review.createdAt)}
					</Text>
					<Cluster class="mt-2" gap="xs">
						<Stars rating={review.rating} size="sm" />
						{#if review.title}<Text bold>{review.title}</Text>{/if}
					</Cluster>
					<Text class="mt-2 whitespace-pre-line">{review.body}</Text>
					<Text class="mt-2">by {review.name}</Text>
					<Form
						class="mt-3"
						{form}
						hidden={{ id: review.id }}
						reset={false}
						schema={ModerateReviewSchema}
					>
						<Cluster gap="xs">
							{#if review.status !== 'approved'}
								<Button {...form.fields.status.as('submit', 'approved')} {form}>Approve</Button>
							{/if}
							{#if review.status !== 'rejected'}
								<Button {...form.fields.status.as('submit', 'rejected')} {form} variant="secondary"
									>Reject</Button
								>
							{/if}
						</Cluster>
					</Form>
				</li>
			{/each}
		</ul>
	{/if}
	{#snippet pending()}
		<Text class="mt-6" color="secondary">Loading…</Text>
	{/snippet}
</Boundary>
