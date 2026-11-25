import { relations, sql } from 'drizzle-orm';
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * Money is integer pence, timestamps are epoch milliseconds (UTC).
 * `sku` is the legacy product code (e.g. GDVVSF20) so image files and old orders map across.
 */
export const categories = sqliteTable('categories', {
	description: text('description').notNull().default(''),
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	sortOrder: integer('sort_order').notNull().default(0),
});

/** A set of products that are the same item in different options, e.g. "Colour": Black / Grey. */
export const variationGroups = sqliteTable('variation_groups', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
});

export const products = sqliteTable(
	'products',
	{
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		/** Pre-discount price shown struck through, when higher than `pricePence`. */
		comparePricePence: integer('compare_price_pence'),
		createdAt: integer('created_at').notNull(),
		description: text('description').notNull().default(''),
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Show "only N left" when the sellable count is at or below this. Null: never. */
		lowStockThreshold: integer('low_stock_threshold'),
		massGrams: integer('mass_grams').notNull().default(0),
		maxPerOrder: integer('max_per_order').notNull().default(10),
		name: text('name').notNull(),
		/** Single units sold together as one purchase; `stock` is held in single units. */
		packSize: integer('pack_size').notNull().default(1),
		pricePence: integer('price_pence').notNull(),
		/** When the product last went from not sellable to sellable (set by `StockService.setStock`). */
		restockedAt: integer('restocked_at'),
		/** Whether the product can be bought now; kept by `StockService` so listings can sort on it. */
		sellable: integer('sellable', { mode: 'boolean' }).notNull().default(false),
		shortDescription: text('short_description').notNull().default(''),
		sku: text('sku').notNull().unique(),
		slug: text('slug').notNull().unique(),
		/** Purchases counted when an order is paid. */
		sold: integer('sold').notNull().default(0),
		sortOrder: integer('sort_order').notNull().default(0),
		/** Units in stock, in single units (a product sold in packs of 10 with 30 in stock sells 3). */
		stock: integer('stock').notNull().default(0),
		variationGroupId: integer('variation_group_id').references(() => variationGroups.id),
		/** This product's option within its variation group, e.g. "Black". */
		variationLabel: text('variation_label'),
	},
	(t) => [
		index('products_listing_idx').on(t.active, sql`${t.sellable} desc`, t.sortOrder, t.name),
		index('products_variation_group_idx').on(t.variationGroupId),
	]
);

/**
 * A combined product is made of other products: it has no stock of its own, and what can be sold is
 * the fewest complete sets the components allow. Paying for it decrements the components.
 */
export const productComponents = sqliteTable(
	'product_components',
	{
		componentId: integer('component_id')
			.notNull()
			.references(() => products.id, { onDelete: 'restrict' }),
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		/** How many of the component one set takes. */
		quantity: integer('quantity').notNull().default(1),
	},
	(t) => [primaryKey({ columns: [t.productId, t.componentId] })]
);

/** Slugs the legacy site used, so old links and search results 301 to the product's current URL. */
export const productSlugAliases = sqliteTable('product_slug_aliases', {
	productId: integer('product_id')
		.notNull()
		.references(() => products.id, { onDelete: 'cascade' }),
	slug: text('slug').primaryKey(),
});

/** "Tell me when it's back" requests. `notifiedAt` is set once the email has gone out. */
export const stockAlerts = sqliteTable(
	'stock_alerts',
	{
		createdAt: integer('created_at').notNull(),
		email: text('email').notNull(),
		id: integer('id').primaryKey({ autoIncrement: true }),
		notifiedAt: integer('notified_at'),
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
	},
	(t) => [uniqueIndex('stock_alerts_product_email_unique').on(t.productId, t.email)]
);

export const productCategories = sqliteTable(
	'product_categories',
	{
		categoryId: integer('category_id')
			.notNull()
			.references(() => categories.id),
		productId: integer('product_id')
			.notNull()
			.references(() => products.id),
	},
	(t) => [
		primaryKey({ columns: [t.productId, t.categoryId] }),
		// A category page looks up its products by category.
		index('product_categories_category_idx').on(t.categoryId, t.productId),
	]
);

/** File names in the R2 bucket (products/<file>). The lowest position is the cover. */
export const productImages = sqliteTable(
	'product_images',
	{
		alt: text('alt').notNull().default(''),
		id: integer('id').primaryKey({ autoIncrement: true }),
		position: integer('position').notNull().default(0),
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		src: text('src').notNull(),
	},
	(t) => [index('product_images_product_idx').on(t.productId, t.position)]
);

export const addresses = sqliteTable('addresses', {
	city: text('city').notNull(),
	/** ISO 3166-1 alpha-2, e.g. GB. */
	country: text('country').notNull(),
	createdAt: integer('created_at').notNull(),
	id: integer('id').primaryKey({ autoIncrement: true }),
	line1: text('line1').notNull(),
	line2: text('line2'),
	name: text('name').notNull(),
	phone: text('phone'),
	postcode: text('postcode').notNull(),
});

export const SHIPPING_ZONES = [
	'uk',
	'europe_eu',
	'europe_other',
	'north_america',
	'world',
] as const;
export type ShippingZone = (typeof SHIPPING_ZONES)[number];

/** Countries we know about. Only `enabled` ones can be chosen at checkout. */
export const countries = sqliteTable('countries', {
	/** ISO 3166-1 alpha-2. */
	code: text('code').primaryKey(),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
	name: text('name').notNull(),
	zone: text('zone', { enum: SHIPPING_ZONES }).notNull(),
});

/**
 * Postage cost by zone and parcel weight: the price for a parcel up to `maxGrams`. The customer
 * is charged `pricePence`. `royalMailServiceCode` is the Click & Drop code; null lets staff choose.
 */
export const shippingRates = sqliteTable(
	'shipping_rates',
	{
		deliveryTime: text('delivery_time').notNull().default(''),
		id: integer('id').primaryKey({ autoIncrement: true }),
		maxGrams: integer('max_grams').notNull(),
		name: text('name').notNull(),
		pricePence: integer('price_pence').notNull(),
		royalMailServiceCode: text('royal_mail_service_code'),
		service: text('service').notNull(),
		zone: text('zone', { enum: SHIPPING_ZONES }).notNull(),
	},
	(t) => [uniqueIndex('shipping_rates_zone_service_weight').on(t.zone, t.service, t.maxGrams)]
);

export const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Click & Drop package formats a parcel can be sent as. */
export const PACKAGE_FORMATS = ['letter', 'largeLetter', 'smallParcel', 'parcel'] as const;
export type PackageFormat = (typeof PACKAGE_FORMATS)[number];

/** Guest checkout: an order belongs to an email address, not an account. */
export const orders = sqliteTable(
	'orders',
	{
		/**
		 * Unguessable secret in the customer's order link (`/order/<number>/<token>`). Guests have no
		 * account, so possession of the link is the access control. Nullable only because SQLite
		 * cannot add a NOT NULL column to existing rows; every new order sets one.
		 */
		accessToken: text('access_token'),
		createdAt: integer('created_at').notNull(),
		discountPence: integer('discount_pence').notNull().default(0),
		/** When the dispatch email was sent, so it is neither forgotten nor sent twice by accident. */
		dispatchEmailedAt: integer('dispatch_emailed_at'),
		email: text('email').notNull(),
		/** Set while the order is on hold (waiting on stock or the customer); cleared to release it. */
		heldAt: integer('held_at'),
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** When the label was created in Click & Drop. */
		labelCreatedAt: integer('label_created_at'),
		/** Public reference shown to the customer (not the row id). */
		number: text('number').notNull().unique(),
		/** Parcel size in mm, as measured when packing. All three or none. */
		packageFormat: text('package_format', { enum: PACKAGE_FORMATS }).notNull().default('parcel'),
		/** When the parcel was packed. Dispatching fills it in if the step was skipped. */
		packedAt: integer('packed_at'),
		/** When someone started packing it, so two people don't pack the same order. */
		packingStartedAt: integer('packing_started_at'),
		paidAt: integer('paid_at'),
		/** Total refunded through Stripe so far, in pence. Equal to `totalPence` means fully refunded. */
		refundedPence: integer('refunded_pence').notNull().default(0),
		/** Click & Drop order identifier, once the order has been pushed to Royal Mail. */
		royalMailOrderId: text('royal_mail_order_id'),
		shippedAt: integer('shipped_at'),
		shippingAddressId: integer('shipping_address_id')
			.notNull()
			.references(() => addresses.id),
		shippingPence: integer('shipping_pence').notNull().default(0),
		/** The `shipping_rates.service` the customer chose. */
		shippingService: text('shipping_service'),
		status: text('status', { enum: ORDER_STATUSES }).notNull().default('pending'),
		/** The Stripe invoice made for this payment (when the shop issues invoices), for its PDF link. */
		stripeInvoiceId: text('stripe_invoice_id'),
		stripePaymentIntentId: text('stripe_payment_intent_id').unique(),
		stripeSessionId: text('stripe_session_id').unique(),
		subtotalPence: integer('subtotal_pence').notNull(),
		totalPence: integer('total_pence').notNull(),
		trackingNumber: text('tracking_number'),
		/** Parcel weight in grams: what the basket weighed, corrected when the parcel is packed. */
		weightGrams: integer('weight_grams'),
	},
	(t) => [
		index('orders_email_idx').on(t.email),
		uniqueIndex('orders_access_token_idx').on(t.accessToken),
	]
);

/** An order's plain product lines. Name and price are copied at purchase time so later catalogue edits never rewrite history. */
export const orderItems = sqliteTable(
	'order_items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		orderId: integer('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
		quantity: integer('quantity').notNull(),
		unitPricePence: integer('unit_price_pence').notNull(),
	},
	(t) => [
		index('order_items_order_idx').on(t.orderId),
		uniqueIndex('order_items_order_product_unique').on(t.orderId, t.productId),
	]
);

/**
 * The bundles an order bought, one row per bundle, at the price paid (two builds of the same bundle
 * are merged into one row). The parts that make it up are in `orderBundleItems`.
 */
export const orderBundles = sqliteTable(
	'order_bundles',
	{
		bundleId: integer('bundle_id').references(() => bundles.id, { onDelete: 'set null' }),
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		orderId: integer('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		quantity: integer('quantity').notNull(),
		unitPricePence: integer('unit_price_pence').notNull(),
	},
	(t) => [uniqueIndex('order_bundles_order_bundle_unique').on(t.orderId, t.bundleId)]
);

/** The parts of a bought bundle, at no charge: paying takes their stock. */
export const orderBundleItems = sqliteTable(
	'order_bundle_items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		orderBundleId: integer('order_bundle_id')
			.notNull()
			.references(() => orderBundles.id, { onDelete: 'cascade' }),
		productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
		quantity: integer('quantity').notNull(),
		/**
		 * True for a kit's parts: `quantity` is single units (16 switches), not purchases (packs), so
		 * paying takes exactly that many from stock.
		 */
		singleUnits: integer('single_units', { mode: 'boolean' }).notNull().default(false),
	},
	(t) => [
		index('order_bundle_items_order_bundle_idx').on(t.orderBundleId),
		uniqueIndex('order_bundle_items_order_bundle_product_unique').on(
			t.orderBundleId,
			t.productId,
			t.singleUnits
		),
	]
);

/**
 * A signed-in customer's Stripe Customer, so Checkout fills in their saved name and address. Keyed
 * by the lower-cased email the customer signs in with (orders are matched to accounts by email).
 */
export const customers = sqliteTable('customers', {
	createdAt: integer('created_at').notNull(),
	email: text('email').primaryKey(),
	stripeCustomerId: text('stripe_customer_id').notNull().unique(),
});

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/**
 * Product reviews from verified buyers: one per product per order, written from the order page.
 * Only `approved` reviews are shown; staff approve or reject them in the admin.
 */
export const reviews = sqliteTable(
	'reviews',
	{
		body: text('body').notNull(),
		createdAt: integer('created_at').notNull(),
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** When staff approved or rejected it. */
		moderatedAt: integer('moderated_at'),
		/** The name shown with the review, as the customer typed it. */
		name: text('name').notNull(),
		/** The order it was written from; null for a review imported from another site. */
		orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }),
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		/** 1 to 5 stars. */
		rating: integer('rating').notNull(),
		status: text('status', { enum: REVIEW_STATUSES }).notNull().default('pending'),
		title: text('title').notNull().default(''),
	},
	(t) => [
		uniqueIndex('reviews_order_product_unique').on(t.orderId, t.productId),
		index('reviews_product_status_idx').on(t.productId, t.status),
	]
);

/**
 * A bundle is built in steps: at each step the customer picks from that step's products. A plain
 * bundle adds the chosen products to the basket as ordinary lines at their own prices. A bundle with
 * a discount, or a kit (it has a `base` step), goes in the basket as one line: a discounted bundle
 * costs its products' prices less `discountPercent`, a kit costs its base's price.
 */
export const bundles = sqliteTable('bundles', {
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull(),
	description: text('description').notNull().default(''),
	/** Off the products' total when bought as this bundle, 0 to 90. Not applied to kits. */
	discountPercent: integer('discount_percent').notNull().default(0),
	id: integer('id').primaryKey({ autoIncrement: true }),
	/** File name in the product image bucket, shown on the bundle page. */
	image: text('image'),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	sortOrder: integer('sort_order').notNull().default(0),
});

/**
 * How a step is chosen. `pick`: between `minChoices` and `maxChoices` different products. A kit's
 * steps: `base`, one product whose `slots` sets the kit's size and whose price is the kit's price;
 * `fill`, fill every slot with single units, repeats allowed up to `maxPerChoice` each; `cover`, one
 * product, a single unit per slot (e.g. keycaps for every switch).
 */
export const BUNDLE_STEP_ROLES = ['pick', 'base', 'fill', 'cover'] as const;
export type BundleStepRole = (typeof BUNDLE_STEP_ROLES)[number];

/** One step of a bundle: pick between `minChoices` and `maxChoices` of its products. */
export const bundleSteps = sqliteTable(
	'bundle_steps',
	{
		bundleId: integer('bundle_id')
			.notNull()
			.references(() => bundles.id, { onDelete: 'cascade' }),
		description: text('description').notNull().default(''),
		id: integer('id').primaryKey({ autoIncrement: true }),
		maxChoices: integer('max_choices').notNull().default(1),
		/** A `fill` step: the most slots one product may take. Null: no limit. */
		maxPerChoice: integer('max_per_choice'),
		/** 0 makes the step optional. */
		minChoices: integer('min_choices').notNull().default(1),
		position: integer('position').notNull().default(0),
		role: text('role', { enum: BUNDLE_STEP_ROLES }).notNull().default('pick'),
		title: text('title').notNull(),
	},
	(t) => [index('bundle_steps_bundle_idx').on(t.bundleId, t.position)]
);

/** The products a step offers, in display order. */
export const bundleStepProducts = sqliteTable(
	'bundle_step_products',
	{
		position: integer('position').notNull().default(0),
		/** A kit's `base` option: the kit's price when not the product's own (a case sold alone for less). */
		pricePence: integer('price_pence'),
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		/** A kit's `base` option: how many slots it holds (a 4x4 tester holds 16). */
		slots: integer('slots'),
		stepId: integer('step_id')
			.notNull()
			.references(() => bundleSteps.id, { onDelete: 'cascade' }),
	},
	(t) => [primaryKey({ columns: [t.stepId, t.productId] })]
);

export const productsRelations = relations(products, ({ many, one }) => ({
	images: many(productImages),
	variationGroup: one(variationGroups, {
		fields: [products.variationGroupId],
		references: [variationGroups.id],
	}),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
	product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const productSlugAliasesRelations = relations(productSlugAliases, ({ one }) => ({
	product: one(products, { fields: [productSlugAliases.productId], references: [products.id] }),
}));
