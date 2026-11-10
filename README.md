# @zeyolabs/shopping

Shop and order fulfilment for SvelteKit 3 on Cloudflare Workers + D1: catalogue, basket, Stripe
Checkout and webhook, orders, Royal Mail Click & Drop, order and dispatch emails, packing, the
shop pages and the admin order pages.

Published as source (no build step): the consuming app compiles it.

## Install

```
pnpm add -E @zeyolabs/shopping @zeyolabs/ui @zeyolabs/kit
```

## Layout

One folder per feature (library, client, service, manager, remote functions, pages, admin). See
`CLAUDE.md` for the map.

## Using it in an app

1. Register the site's config once on the server: `configureShopping({...})` (brand, shipping,
   order prefix, `db`, secret names, `mail`), imported by `hooks.server.ts`, and pass its secret
   names to `runWithContext`.
2. In the root layout, `setShopContext({ imageBaseUrl, siteName, siteUrl, supportEmail })`.
3. Thin routes: render the pages (`<Basket startCheckout={...} />`, `<Shop description intro shop={data.shop} />`)
   and re-export handlers and loads from `@zeyolabs/shopping/<feature>/*.server`.
4. Tailwind must scan the components: `@source "../node_modules/@zeyolabs/shopping";`.
5. Generate D1 migrations in the app from `@zeyolabs/shopping/db/schema` (drizzle-kit).

## Optional features

- **Discount codes**: `checkout.promotionCodes: true` shows Stripe's promotion-code box at
  Checkout. Codes are made and limited in the Stripe dashboard; orders record the discount.
- **Invoices**: `checkout.invoices: { footer, customFields }` has Stripe issue a paid invoice PDF
  per order (Stripe charges per invoice). Customers get it from their order page
  (`orders/invoice.server`), staff from the admin order (`fulfilment/invoice.server`).
- **Search**: `catalogue/pages/Search.svelte` + `searchLoad`.
- **Customer accounts**: `customers/pages/Account.svelte` lists the orders for the signed-in email; sign-in
  is kit's passwordless auth in the app. `CheckoutManager.start({ email })` passes the customer to Stripe
  so their saved details are filled in.
- **Reviews**: verified buyers review items from their order page; staff moderate in
  `reviews/admin/ReviewsPage.svelte`; approved reviews show on the product page.
- **Bundles**: `bundles/pages/Bundle.svelte` + `bundleLoad`; the customer picks per step and the picks go
  into the basket as ordinary products. Edited in `bundles/admin/BundlesPage.svelte`.
- **Product admin**: `catalogue/admin/` (`ProductsPage`, `ProductEditPage`, `CategoriesPage`).

## Versions

Every merge to `main` publishes a new version (`.github/workflows/publish.yaml`); there is no
release step. Versions are `YYYY.M.N` in London time: `N` counts that month's releases and resets
each month (`2026.11.7`, then `2026.12.0`). CI sets the version and pushes the `vYYYY.M.N` tag;
docs- or CI-only changes don't publish. Publishing uses npm trusted publishing (no stored token).

## Checks

`pnpm check`: prettier, eslint, vitest.
