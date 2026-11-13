CREATE TABLE `addresses` (
	`city` text NOT NULL,
	`country` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`line1` text NOT NULL,
	`line2` text,
	`name` text NOT NULL,
	`phone` text,
	`postcode` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`description` text DEFAULT '' NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer,
	`quantity` integer NOT NULL,
	`sku` text NOT NULL,
	`unit_price_pence` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`created_at` integer NOT NULL,
	`discount_pence` integer DEFAULT 0 NOT NULL,
	`email` text NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`paid_at` integer,
	`shipped_at` integer,
	`shipping_address_id` integer NOT NULL,
	`shipping_pence` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`stripe_payment_intent_id` text,
	`stripe_session_id` text,
	`subtotal_pence` integer NOT NULL,
	`total_pence` integer NOT NULL,
	`tracking_number` text,
	FOREIGN KEY (`shipping_address_id`) REFERENCES `addresses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_unique` ON `orders` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_stripe_payment_intent_id_unique` ON `orders` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_stripe_session_id_unique` ON `orders` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `orders_email_idx` ON `orders` (`email`);--> statement-breakpoint
CREATE TABLE `product_categories` (
	`category_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	PRIMARY KEY(`product_id`, `category_id`),
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`alt` text DEFAULT '' NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`product_id` integer NOT NULL,
	`src` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_images_product_idx` ON `product_images` (`product_id`,`position`);--> statement-breakpoint
CREATE TABLE `products` (
	`active` integer DEFAULT true NOT NULL,
	`compare_price_pence` integer,
	`created_at` integer NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mass_grams` integer DEFAULT 0 NOT NULL,
	`max_per_order` integer DEFAULT 10 NOT NULL,
	`name` text NOT NULL,
	`price_pence` integer NOT NULL,
	`short_description` text DEFAULT '' NOT NULL,
	`sku` text NOT NULL,
	`slug` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`variation_group_id` integer,
	`variation_label` text,
	FOREIGN KEY (`variation_group_id`) REFERENCES `variation_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE TABLE `variation_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_items_order_sku_unique` ON `order_items` (`order_id`,`sku`);
--> statement-breakpoint
CREATE TABLE `countries` (
	`code` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`zone` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shipping_rates` (
	`delivery_time` text DEFAULT '' NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`max_grams` integer NOT NULL,
	`name` text NOT NULL,
	`price_pence` integer NOT NULL,
	`royal_mail_service_code` text,
	`service` text NOT NULL,
	`zone` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipping_rates_zone_service_weight` ON `shipping_rates` (`zone`,`service`,`max_grams`);--> statement-breakpoint
ALTER TABLE `orders` ADD `royal_mail_order_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_service` text;
--> statement-breakpoint
CREATE TABLE `product_slug_aliases` (
	`product_id` integer NOT NULL,
	`slug` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stock_alerts` (
	`created_at` integer NOT NULL,
	`email` text NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notified_at` integer,
	`product_id` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_alerts_product_email_unique` ON `stock_alerts` (`product_id`,`email`);
--> statement-breakpoint
ALTER TABLE `orders` ADD `access_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_access_token_idx` ON `orders` (`access_token`);
--> statement-breakpoint
-- Product photos move from WebP to AVIF, and the legacy 300px "<sku>.webp" thumbnail is dropped.
-- The import had put that thumbnail first in every gallery: it duplicates the first real photo at
-- a lower resolution. A product whose thumbnail is its only image keeps it.
-- The .avif files must be in R2 (scripts/upload-product-images.mjs) before this is deployed.

DELETE FROM product_images
WHERE src = (SELECT sku FROM products WHERE products.id = product_images.product_id) || '.webp'
	AND (SELECT count(*) FROM product_images AS other WHERE other.product_id = product_images.product_id) > 1;
--> statement-breakpoint

-- Close the gap the removed thumbnail left at position 0.
UPDATE product_images SET position = position - 1
WHERE product_id IN (SELECT product_id FROM product_images GROUP BY product_id HAVING min(position) > 0);
--> statement-breakpoint

UPDATE product_images SET src = substr(src, 1, length(src) - 5) || '.avif' WHERE src LIKE '%.webp';
--> statement-breakpoint
ALTER TABLE `orders` ADD `dispatch_emailed_at` integer;
--> statement-breakpoint
ALTER TABLE `orders` ADD `held_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `label_created_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `packed_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `package_format` text DEFAULT 'parcel' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `package_height_mm` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `package_length_mm` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `package_width_mm` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `packing_started_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `weight_grams` integer;
--> statement-breakpoint
CREATE TABLE `account_invites` (
	`accepted_at` integer,
	`account_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`invited_by` integer,
	`policy` text NOT NULL,
	`token_hash` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `account_invites_account_id_idx` ON `account_invites` (`account_id`);--> statement-breakpoint
CREATE INDEX `account_invites_email_idx` ON `account_invites` (`email`);--> statement-breakpoint
CREATE TABLE `account_members` (
	`account_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`policy` text NOT NULL,
	`user_id` integer NOT NULL,
	PRIMARY KEY(`account_id`, `user_id`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_members_user_id_idx` ON `account_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `account_policies` (
	`account_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`permissions` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_policies_account_key_idx` ON `account_policies` (`account_id`,`key`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`created_at` integer NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_slug_unique` ON `accounts` (`slug`);--> statement-breakpoint
CREATE TABLE `auth_tokens` (
	`created_at` integer NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`token_hash` text PRIMARY KEY NOT NULL,
	`used_at` integer
);
--> statement-breakpoint
CREATE INDEX `auth_tokens_email_idx` ON `auth_tokens` (`email`);--> statement-breakpoint
CREATE TABLE `passkeys` (
	`algorithm` integer NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`last_used_at` integer,
	`name` text NOT NULL,
	`public_key` blob NOT NULL,
	`sign_count` integer NOT NULL,
	`transports` text DEFAULT '' NOT NULL,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `passkeys_user_id_idx` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`last_used_at` integer NOT NULL,
	`secret_hash` text NOT NULL,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`avatar_url` text,
	`created_at` integer NOT NULL,
	`email` text NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `product_components` (
	`component_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`product_id`, `component_id`),
	FOREIGN KEY (`component_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `products` ADD `low_stock_threshold` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `pack_size` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `restocked_at` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `sold` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `bundle_step_products` (
	`position` integer DEFAULT 0 NOT NULL,
	`product_id` integer NOT NULL,
	`step_id` integer NOT NULL,
	PRIMARY KEY(`step_id`, `product_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`step_id`) REFERENCES `bundle_steps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bundle_steps` (
	`bundle_id` integer NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`max_choices` integer DEFAULT 1 NOT NULL,
	`min_choices` integer DEFAULT 1 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	FOREIGN KEY (`bundle_id`) REFERENCES `bundles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bundle_steps_bundle_idx` ON `bundle_steps` (`bundle_id`,`position`);--> statement-breakpoint
CREATE TABLE `bundles` (
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`image` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bundles_slug_unique` ON `bundles` (`slug`);--> statement-breakpoint
CREATE TABLE `customers` (
	`created_at` integer NOT NULL,
	`email` text PRIMARY KEY NOT NULL,
	`stripe_customer_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_stripe_customer_id_unique` ON `customers` (`stripe_customer_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`moderated_at` integer,
	`name` text NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_order_product_unique` ON `reviews` (`order_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `reviews_product_status_idx` ON `reviews` (`product_id`,`status`);--> statement-breakpoint
ALTER TABLE `orders` ADD `stripe_invoice_id` text;
