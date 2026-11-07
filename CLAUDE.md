# CLAUDE.md

`@zeyolabs/shopping`: all the shop and order code, reusable by any site. First user: Pure
Leaves. Depends on `@zeyolabs/kit` and `@zeyolabs/ui`.

## Nothing site-specific

The brand, shipping thresholds, image URL, order prefix, database, the _names_ of secrets and one
function per email (`mail.orderConfirmed`, `newOrderAlert`, `orderDispatched`) arrive through
`configureShopping()`, which just stores the config object. Secrets are read with
`envStore().secret(name)`, so the app passes its `secretNames` to `runWithContext`. The emails
default to `defaultShopMail`; a site can replace any of them. Page copy that names the site uses
`shoppingClient().siteName` or comes in as a prop (e.g. `<Shop description intro>`).

## What is in it

The Drizzle schema (`db/schema`; each app generates its own migrations from it), basket,
catalogue, shipping rules, Stripe checkout and webhook, orders, Royal Mail Click & Drop, order and
dispatch emails, packing, the remote functions (`remote/*.remote.ts`), the shop and admin pages
(`pages/`, `admin/`, components), route handlers (`routes/`) and the server `load`s for public
catalogue pages (`routes/catalogue-loads.ts`).

Apps keep thin route files that render or re-export the package's: `<Basket />`,
`export { POST } from '@zeyolabs/shopping/routes/stripe-webhook'`,
`export { productLoad as load } from '@zeyolabs/shopping/routes/catalogue-loads'`.
The back-in-stock email and `sendBackInStockBatch()` (`server/stock-alerts.ts`) live here; the app runs it from
a cron Worker (one batch per run, so the app sets the pace) and keeps the signup form. Admin has a stock
page (`admin/StockPage.svelte`); its remote functions and the other admin ones have no auth of their own, so the app
must guard every admin route and remote call (pureleaves does it in `apps/admin`'s hooks). `ShopMail.backInStock` is optional: a shop without it sends nothing.
Signup form and checkout stay in the app (Turnstile / rate limiter): the product page takes an
`outOfStock` snippet, the basket page takes the app's `startCheckout` remote function.

Pages run in the browser too, so they cannot read the server config: the app's root layout calls
`setShoppingClient({ imageBaseUrl, siteName, siteUrl, supportEmail })`; anything else arrives as
data from a remote function or a `load`.

## Rules

- Remote functions and components follow the consuming app's remote-function rules (Pure Leaves
  `docs/sveltekit-remote.md`): queries awaited in markup inside `<Boundary>`, never in `<script>`;
  no remote calls in `$effect`; public pages load on the server; form controls via `.as()`.
- Shipped as source; `exports`/`files` must cover every public file.
- Money is integer pence, GBP only for now (`money.ts`). Timestamps are epoch ms.
- Dependency versions are exact; `svelte`, `@sveltejs/kit`, `drizzle-orm`, `zod` and the other
  zeyo packages are peers.
- Merging to `main` publishes a new `YYYY.M.N` version automatically (see README). Never tag or
  publish by hand.
