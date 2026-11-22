<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Badge from '@zeyolabs/ui/badge/Badge.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import { CheckboxField, Form, NumberField, SelectField, TextField } from '@zeyolabs/ui/form';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import Head from '@zeyolabs/ui/head/Head.svelte';
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';
	import { toast } from 'svelte-sonner';

	import { shopContext } from '../../context';
	import { PACKAGE_FORMATS } from '../../db/schema';
	import { Orders } from '../../orders/library';
	import { ErrorMessage } from '../../utils/errors';
	import { FormInput } from '../../utils/form-input';
	import { Images } from '../../utils/images';
	import { Money } from '../../utils/money';
	import {
		createOrderLabel,
		detailsForm,
		getOrder,
		getShippingServices,
		parcelForm,
		refundForm,
		shipForm,
		updateOrderForm,
	} from '../admin.remote';
	import { Packing } from '../library';
	import {
		OrderDetailsSchema,
		OrderStepSchema,
		ParcelSchema,
		RefundSchema,
		ShipSchema,
	} from '../schema';

	const context = shopContext();
	const number = $derived(page.params.number ?? '');

	let printing = $state(false);

	/** Creates the label in Click & Drop, then opens the PDF to print when Royal Mail serves it. */
	async function printLabel(orderNumber: string) {
		printing = true;
		try {
			const { pdf, royalMailOrderId } = await createOrderLabel(orderNumber);
			if (pdf) window.open(resolve('/orders/[number]/label', { number: orderNumber }), '_blank');
			else toast.success(`In Click & Drop as order ${royalMailOrderId}. Print the label there.`);
		} catch (error) {
			toast.error(ErrorMessage.from(error, 'Could not create the label.'));
		} finally {
			printing = false;
		}
	}

	const date = new Intl.DateTimeFormat('en-GB', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Europe/London',
	});
</script>

<Head title={number} />

<Text><a href={resolve('/orders')}>← Orders</a></Text>

<Boundary message="Could not load this order." statusMessages={{ 404: 'Order not found.' }}>
	{let order = $derived(await getOrder(number))}
	<Cluster class="mt-4" gap="sm">
		<Title level={1} size="md">{order.number}</Title>
		<Badge
			color={order.status === 'paid'
				? 'warning'
				: order.status === 'shipped'
					? 'success'
					: 'neutral'}
		>
			{order.status === 'paid' ? 'To ship' : order.status}
		</Badge>
	</Cluster>
	<Text class="mt-1" color="secondary">
		Placed {date.format(order.createdAt)}{order.paidAt
			? ` · paid ${date.format(order.paidAt)}`
			: ''}
	</Text>

	<div class="mt-6 grid gap-6 md:grid-cols-2">
		<section class="rounded-xl border border-[var(--bd)] bg-white p-5">
			<Title level={2} size="sm">Ship to</Title>
			<address class="mt-2 not-italic select-all">
				{order.address.name}<br />
				{order.address.line1}<br />
				{#if order.address.line2}{order.address.line2}<br />{/if}
				{order.address.city}<br />
				{order.address.postcode}<br />
				{order.address.country}
			</address>
			<Text class="mt-3">
				<a href="mailto:{order.email}">{order.email}</a>{order.address.phone
					? ` · ${order.address.phone}`
					: ''}
			</Text>
			<Text class="mt-3" color="secondary">
				Service: {order.shippingService ?? 'n/a'}
				{#if order.royalMailOrderId}· Click &amp; Drop order {order.royalMailOrderId}{/if}
			</Text>
		</section>

		<section class="rounded-xl border border-[var(--bd)] bg-white p-5">
			<Title level={2} size="sm">Items</Title>
			<ul class="mt-2 divide-y divide-[var(--bd)]">
				{#each order.items as item (item.id)}
					<li class="py-2">
						<Cluster gap="sm" nowrap>
							{#if item.cover}
								<img
									class="size-14 shrink-0 rounded-md object-cover"
									alt={item.cover.alt || item.name}
									src={Images.url(context.imageBaseUrl, item.cover.src)}
								/>
							{:else}
								<div class="size-14 shrink-0 rounded-md bg-[var(--bd)]"></div>
							{/if}
							<Cluster class="grow" gap="sm" justify="between" nowrap>
								<Span>{item.name} <Span color="secondary">× {item.quantity}</Span></Span>
								<Span>{Money.format(item.quantity * item.unitPricePence)}</Span>
							</Cluster>
						</Cluster>
					</li>
				{/each}
			</ul>
			<dl class="mt-3 space-y-1">
				<div class="flex justify-between">
					<dt><Span size="sm">Subtotal</Span></dt>
					<dd><Span size="sm">{Money.format(order.subtotalPence)}</Span></dd>
				</div>
				{#if order.discountPence > 0}
					<div class="flex justify-between">
						<dt><Span size="sm">Discount</Span></dt>
						<dd><Span size="sm">-{Money.format(order.discountPence)}</Span></dd>
					</div>
				{/if}
				<div class="flex justify-between">
					<dt><Span size="sm">Delivery</Span></dt>
					<dd>
						<Span size="sm"
							>{order.shippingPence === 0 ? 'Free' : Money.format(order.shippingPence)}</Span
						>
					</dd>
				</div>
				<div class="flex justify-between">
					<dt><Span bold size="sm">Total</Span></dt>
					<dd><Span bold size="sm">{Money.format(order.totalPence)}</Span></dd>
				</div>
				{#if order.refundedPence > 0}
					<div class="flex justify-between">
						<dt><Span size="sm">Refunded</Span></dt>
						<dd><Span size="sm">-{Money.format(order.refundedPence)}</Span></dd>
					</div>
				{/if}
			</dl>
		</section>
	</div>

	{#if order.status === 'paid'}
		{let stage = $derived(Packing.stage(order))}
		<section class="mt-6 max-w-xl rounded-xl border border-[var(--bd)] bg-white p-5">
			<Cluster gap="sm">
				<Title level={2} size="sm">Packing</Title>
				<Badge color={Packing.STAGE_COLORS[stage]}>{Packing.STAGE_LABELS[stage]}</Badge>
			</Cluster>
			<Text class="mt-1" color="secondary">
				{#if order.heldAt}On hold since {date.format(order.heldAt)}.{/if}
				{#if order.packingStartedAt}Packing started {date.format(order.packingStartedAt)}.{/if}
				{#if order.packedAt}Packed {date.format(order.packedAt)}.{/if}
				{#if order.labelCreatedAt}Label created {date.format(order.labelCreatedAt)}.{/if}
			</Text>
			<Form
				class="mt-4"
				form={updateOrderForm}
				hidden={{ number: order.number }}
				schema={OrderStepSchema}
			>
				<Cluster gap="xs">
					{#if stage === 'new'}
						<Button {...updateOrderForm.fields.step.as('submit', 'start')} form={updateOrderForm}
							>Start packing</Button
						>
					{:else if stage === 'packing'}
						<Button
							{...updateOrderForm.fields.step.as('submit', 'pack')}
							form={updateOrderForm}
							variant="secondary"
						>
							Mark packed
						</Button>
					{:else if stage === 'packed' || stage === 'label'}
						<Button disabled={printing} onclick={() => printLabel(order.number)}>
							{order.labelCreatedAt ? 'Reprint label' : 'Print label'}
						</Button>
					{/if}
					{#if stage === 'held'}
						<Button
							{...updateOrderForm.fields.step.as('submit', 'release')}
							form={updateOrderForm}
							variant="secondary"
						>
							Release hold
						</Button>
					{:else if stage !== 'label'}
						<Button
							{...updateOrderForm.fields.step.as('submit', 'hold')}
							form={updateOrderForm}
							variant="secondary"
						>
							Put on hold
						</Button>
					{/if}
				</Cluster>
			</Form>

			<Text class="mt-3" color="secondary">
				Printing the label sends the saved parcel details to Royal Mail and marks the order packed.
				{#if order.labelCreatedAt}A label is already made, so later parcel changes will not change
					it.{/if}
			</Text>

			<Title class="mt-6" level={3} size="sm">Parcel</Title>
			<Text class="mt-1" color="secondary">
				{order.weightGrams === null
					? `Estimated ${order.estimatedWeightGrams} g from the items. Weigh the parcel and correct it.`
					: 'Weight and format go on the Royal Mail label.'}
			</Text>
			<Form
				class="mt-3 grid gap-4"
				defaults={{
					format: order.packageFormat,
					weightGrams: order.weightGrams ?? (order.estimatedWeightGrams || undefined),
				}}
				form={parcelForm}
				hidden={{ number: order.number }}
				reset={false}
				schema={ParcelSchema}
			>
				<NumberField name="weightGrams" form={parcelForm} inputmode="numeric"
					>Weight (g)</NumberField
				>
				<SelectField
					name="format"
					form={parcelForm}
					getLabel={(f) => Packing.FORMAT_LABELS[f]}
					items={PACKAGE_FORMATS}
					placeholder="Package format"
				/>
				<div><Button form={parcelForm}>Save parcel</Button></div>
			</Form>
		</section>
	{/if}

	{#if order.status === 'paid' || order.status === 'shipped'}
		{let services = $derived(await getShippingServices())}
		<section class="mt-6 max-w-xl rounded-xl border border-[var(--bd)] bg-white p-5">
			<details>
				<summary class="cursor-pointer"><Span bold>Edit contact, address and postage</Span></summary
				>
				<Text class="mt-2" color="secondary">
					For fixing a typo or a customer's request. If you change the country, check the postage
					service still fits. {#if order.status === 'paid' && order.labelCreatedAt}The label is
						already made, so after a change you need to print it again.{/if}
				</Text>
				<Form
					class="mt-4 grid gap-4"
					defaults={{
						city: order.address.city,
						country: order.address.country,
						email: order.email,
						line1: order.address.line1,
						line2: order.address.line2 ?? '',
						name: order.address.name,
						phone: order.address.phone ?? '',
						postcode: order.address.postcode,
						shippingService: order.shippingService ?? '',
						trackingNumber: order.trackingNumber ?? '',
					}}
					form={detailsForm}
					hidden={{ number: order.number }}
					reset={false}
					schema={OrderDetailsSchema}
				>
					<TextField name="name" form={detailsForm}>Name</TextField>
					<TextField name="email" form={detailsForm} inputmode="email">Email</TextField>
					<TextField name="phone" form={detailsForm} inputmode="tel" optional>Phone</TextField>
					<TextField name="line1" form={detailsForm}>Address line 1</TextField>
					<TextField name="line2" form={detailsForm} optional>Address line 2</TextField>
					<TextField name="city" form={detailsForm}>Town or city</TextField>
					<TextField name="postcode" autocapitalize="characters" form={detailsForm}
						>Postcode</TextField
					>
					<TextField name="country" autocapitalize="characters" form={detailsForm}
						>Country code (e.g. GB)</TextField
					>
					<SelectField
						name="shippingService"
						form={detailsForm}
						getLabel={(s) => services.find((x) => x.service === s)?.name ?? s}
						items={services.map((s) => s.service)}
						placeholder="Postage service"
					/>
					{#if order.status === 'shipped'}
						<TextField
							name="trackingNumber"
							autocapitalize="characters"
							form={detailsForm}
							optional
						>
							Tracking number (no email is sent)
						</TextField>
					{/if}
					<div><Button form={detailsForm}>Save details</Button></div>
				</Form>
			</details>
		</section>
	{/if}

	{#if (order.status === 'paid' || order.status === 'shipped') && order.stripePaymentIntentId && order.refundedPence < order.totalPence}
		{let left = $derived(order.totalPence - order.refundedPence)}
		<section class="mt-6 max-w-xl rounded-xl border border-[var(--bd)] bg-white p-5">
			<Title level={2} size="sm">Refund</Title>
			<Text class="mt-1" color="secondary">
				Up to {Money.format(left)} can be refunded to the customer's card through Stripe. A full refund
				marks the order refunded, even if it had shipped, and does not cancel a Royal Mail label. Stock
				is not put back; do that on the stock page if the goods come back.
			</Text>
			<Form
				class="mt-4 grid gap-4"
				defaults={{ amount: FormInput.penceToPounds(left) }}
				form={refundForm}
				hidden={{ number: order.number }}
				reset={false}
				schema={RefundSchema}
			>
				<TextField name="amount" form={refundForm} inputmode="decimal">Amount (£)</TextField>
				<div><Button form={refundForm} variant="secondary">Refund</Button></div>
			</Form>
		</section>
	{/if}

	<section class="mt-6 max-w-xl rounded-xl border border-[var(--bd)] bg-white p-5">
		<Title level={2} size="sm">Dispatch</Title>
		{#if order.status === 'paid' || order.status === 'shipped'}
			{#if order.shippedAt}
				<Text class="mt-1" color="secondary">
					Dispatched {date.format(order.shippedAt)}.
					{#if order.dispatchEmailedAt}
						Customer emailed {date.format(order.dispatchEmailedAt)}.
					{:else}
						The customer has <strong>not</strong> been emailed.
					{/if}
				</Text>
			{:else}
				<Text class="mt-1" color="secondary">
					Enter the Royal Mail tracking number (leave blank if untracked), then mark it dispatched.
					The customer is emailed straight away and their order page updates.
				</Text>
			{/if}
			<Form
				class="mt-4 grid gap-4"
				defaults={{ skipEmail: false, trackingNumber: order.trackingNumber ?? '' }}
				form={shipForm}
				hidden={{ number: order.number }}
				reset={false}
				schema={ShipSchema}
			>
				<TextField name="trackingNumber" autocapitalize="characters" form={shipForm} optional>
					Tracking number
				</TextField>
				<CheckboxField name="skipEmail" form={shipForm}>Do not email the customer</CheckboxField>
				<div>
					<Button form={shipForm} loadingMessage="Sending…">
						{order.shippedAt ? 'Save and resend email' : 'Mark as dispatched and email customer'}
					</Button>
				</div>
			</Form>
		{:else}
			<Text class="mt-1">This order is {order.status}, so it cannot be dispatched.</Text>
		{/if}

		{#if order.trackingNumber}
			<Text class="mt-4">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external Royal Mail URL -->
				<a href={Orders.trackingUrl(order.trackingNumber)} rel="noopener" target="_blank"
					>Track {order.trackingNumber} on Royal Mail</a
				>
			</Text>
		{/if}
		{#if order.stripeInvoiceId}
			<Text class="mt-2">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- server route, opens Stripe's PDF -->
				<a href="/orders/{order.number}/invoice" rel="external" target="_blank">Invoice (PDF)</a>
			</Text>
		{/if}
		{#if order.customerUrl}
			<Text class="mt-2">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- absolute URL on the shop domain -->
				<a href={order.customerUrl} rel="noopener" target="_blank">Customer's order page</a>
			</Text>
		{/if}
	</section>
	{#snippet pending()}
		<Text class="mt-6" color="secondary">Loading…</Text>
	{/snippet}
</Boundary>
