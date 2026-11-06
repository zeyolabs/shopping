# @zeyolabs/shopping

Shop and order fulfilment for SvelteKit 3 on Cloudflare Workers + D1: catalogue, basket, Stripe
Checkout and webhook, orders, Royal Mail Click & Drop, order and dispatch emails, packing, the
shop pages and the admin order pages.

Published as source (no build step): the consuming app compiles it.

## Install

```
pnpm add -E @zeyolabs/shopping @zeyolabs/ui @zeyolabs/kit
```

## Using it in an app

1. Register the site's config once on the server: `configureShopping({...})` (brand, shipping,
   order prefix, `db`, secret names, `mail`), imported by `hooks.server.ts`, and pass its secret
   names to `runWithContext`.
2. In the root layout, `setShoppingClient({ imageBaseUrl, siteName, siteUrl, supportEmail })`.
3. Thin routes: render the pages (`<Basket startCheckout={...} />`, `<Shop description intro shop={data.shop} />`)
   and re-export handlers and loads from `@zeyolabs/shopping/routes/*`.
4. Tailwind must scan the components: `@source "../node_modules/@zeyolabs/shopping";`.
5. Generate D1 migrations in the app from `@zeyolabs/shopping/db/schema` (drizzle-kit).

## Versions

Every merge to `main` publishes a new version (`.github/workflows/publish.yaml`); there is no
release step. Versions are `YYYY.M.N` in London time: `N` counts that month's releases and resets
each month (`2026.11.7`, then `2026.12.0`). CI sets the version and pushes the `vYYYY.M.N` tag;
docs- or CI-only changes don't publish. Publishing uses npm trusted publishing (no stored token).

## Checks

`pnpm check`: prettier, eslint, vitest.
