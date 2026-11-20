<script lang="ts">
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import Stars from '../../ui/Stars.svelte';

	type Review = {
		body: string;
		createdAt: number;
		id: number;
		name: string;
		rating: number;
		title: string;
	};

	let { reviews }: { reviews: { average: null | number; count: number; list: Review[] } } =
		$props();

	const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Europe/London' });
</script>

<section id="reviews" class="mt-12" aria-label="Reviews">
	<Title level={2} size="md">Reviews</Title>
	{#if reviews.count === 0 || reviews.average === null}
		<Text class="mt-2" color="secondary">
			No reviews yet. Bought this? You can review it from your order page.
		</Text>
	{:else}
		<Cluster class="mt-2" gap="xs">
			<Stars rating={reviews.average} />
			<Span
				>{reviews.average} out of 5, from {reviews.count}
				{reviews.count === 1 ? 'review' : 'reviews'}</Span
			>
		</Cluster>
		<ul class="mt-4 divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
			{#each reviews.list as review (review.id)}
				<li class="py-4">
					<Cluster gap="xs">
						<Stars rating={review.rating} size="sm" />
						{#if review.title}<Span bold>{review.title}</Span>{/if}
					</Cluster>
					<Text class="mt-2 whitespace-pre-line">{review.body}</Text>
					<Text class="mt-2" color="secondary">
						{review.name}, verified buyer, {date.format(review.createdAt)}
					</Text>
				</li>
			{/each}
		</ul>
	{/if}
</section>
