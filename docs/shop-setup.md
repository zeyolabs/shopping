# Setting up a shop on `@zeyolabs/shopping`

The package is all the shop and order code. Nothing site-specific goes in it: the app supplies the
brand, shipping rules, order prefix, database and mail through `configureShopping()`.

## Config

`packages/core/shopping.ts` calls `configureShopping({ brand, checkout, db, mail, orderNumberPrefix,
shipping, siteUrl })`. Importing that file registers it, so each app's `hooks.server.ts` imports
`core/shopping` and nothing else is needed. Mail uses the package's `defaultShopMail`; a site can
replace any email.

## Bindings

The package reads these from `envStore()` under fixed names, so the app binds them under exactly
these names and lists the secrets in `Secrets` (`core/secrets.ts`):

- Secrets: `ROYALMAIL_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Var: `IMAGE_BASE_URL`.

A Secrets Store `secret_name` can differ (`STRIPE_TEST_SECRET_KEY` and `STRIPE_LIVE_SECRET_KEY` both
feed `STRIPE_SECRET_KEY`); going live changes the `secret_name` in `wrangler.jsonc`, not the code.

## Routes

Apps keep thin route files that render or re-export the package's:

- `<Basket />` in `routes/basket/+page.svelte`.
- `export { POST } from '@zeyolabs/shopping/checkout/webhook.server'` for the webhook.

Checkout and back-in-stock stay in the app because they need Turnstile and the rate limiter. The
product page takes an `outOfStock` snippet. The basket page takes the app's `startCheckout` remote
function, which rate limits and then calls `CheckoutManager.start()`.

## Browser context

Pages also run in the browser and cannot read the server config. The root layout calls
`setShopContext({ imageBaseUrl, siteName, siteUrl, supportEmail })`; anything else a page needs
arrives as data from a remote function.

## Webhook

Stripe's webhook is served by its own Worker (`workers/payments`, `PaymentsWorker.create()`) on a
host that never moves with the shop's domain, for example `payments.<domain>`. Events:
`checkout.session.completed` and `checkout.session.async_payment_succeeded`. The signing secret is
bound as `STRIPE_WEBHOOK_SECRET`.

## Schema and styles

- The Drizzle schema is `@zeyolabs/shopping/db/schema`; each app generates its own migrations from it.
- Tailwind must scan the components: `@source "../node_modules/@zeyolabs/shopping";`.
- Money is GBP only for now (`@zeyolabs/shopping/money`).
