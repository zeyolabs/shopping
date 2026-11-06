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

Date versions: `YYYY.MMDD.N`: the release day in London as month × 100 + day (semver forbids
leading zeros, so 6 November is `1106` and 5 January `105`), then that day's release count from 0:
`2026.1106.0`, `2026.1106.1`, `2026.1107.0`. Earlier releases used `YYYY.M.D` (`2026.11.6`). Publishing uses npm trusted publishing (no stored token).

```
pnpm release                          # sets the version, commits, tags vYYYY.MMDD.N
git push origin HEAD vYYYY.MMDD.N      # the tag publishes to npm (publish.yaml)
```

## Checks

`pnpm check`: prettier, eslint, vitest.
