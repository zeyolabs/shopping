# CLAUDE.md

`@zeyolabs/shopping`: all the shop and order code, reusable by any site. First user: Pure
Leaves. Depends on `@zeyolabs/kit` and `@zeyolabs/ui`.

## Nothing site-specific

The brand, shipping thresholds, image URL, order prefix, database, the _names_ of secrets and one
function per email (`mail.orderConfirmed`, `newOrderAlert`, `orderDispatched`) arrive through
`configureShopping()`, which just stores the config object. Secrets are read with
`envStore().secret(name)`, so the app passes its `secretNames` to `runWithContext`. The emails
default to `defaultShopMail`; a site can replace any of them. Page copy that names the site uses
`shopContext().siteName` or comes in as a prop (e.g. `<Shop description intro>`).

## Layout

One folder per feature, following the codex (`_workspace/standards/codex`): **library** (pure
objects, `library.ts`), **client** (one outside API, config passed in, `clients/`), **service**
(data access, a class that takes `db`, `service.server.ts`), **manager** (the edge's entry point
where there is real work beyond data access, `manager.server.ts`). Remote functions
(`client.remote.ts` for shoppers, `admin.remote.ts` for staff) resolve the db once and bind a
service to a `const`. Services never read `shopping()` or secrets; managers and remote functions do.

| Folder                    | What                                                                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalogue/`              | `CatalogueService` (categories, products, search, redirects, sitemap), `Search` library, loads, shop/category/product/search pages, `CatalogueAdminService` + product and category admin |
| `stock/`                  | `Stock` library (pack size, combined sets, badge), `StockService` (sellable counts, the paid decrement, the only stock write path), stock admin page                                     |
| `stock-alerts/`           | `StockAlertService` (signups), `BackInStockJob` (the cron run), the email                                                                                                                |
| `basket/`                 | `BasketCookie` library, `BasketCookies` (cookie I/O), `BasketService` (pricing), basket page                                                                                             |
| `checkout/`               | `CheckoutManager.start` (Stripe Checkout), the complete and webhook handlers, success page                                                                                               |
| `orders/`                 | `Orders` library (numbers, links), `OrderService`, `OrderManager` (fulfil a paid session, invoice links), `OrderEmails`, order page                                                      |
| `fulfilment/`             | `Packing` library, `FulfilmentService`, `FulfilmentManager` (packing, labels, dispatch), `DispatchEmail`, admin order pages                                                              |
| `shipping/`               | `Postage` library, `ShippingService`                                                                                                                                                     |
| `customers/`              | `CustomerService` (Stripe Customer, orders by email), account page                                                                                                                       |
| `reviews/`                | `ReviewService`, review form and list, admin moderation                                                                                                                                  |
| `bundles/`                | `BundleService`, bundle builder page, admin editor                                                                                                                                       |
| `clients/`                | `StripeClient`, `RoyalMailClient`, `ShopClients` (both built with the shop's secrets, for managers)                                                                                      |
| `mail/`                   | `defaultShopMail`: renders the emails and hands them to the app's `send`                                                                                                                 |
| `utils/`, `ui/`, `db/`    | `Money`, `Images`, `FormInput`; `PageTitle`, `Stars`; the Drizzle schema                                                                                                                 |
| `config.ts`, `context.ts` | server config (`configureShopping`), browser context (`setShopContext`)                                                                                                                  |

Apps import by path: `@zeyolabs/shopping/<folder>/<file>` (`.ts` implied, `.svelte` explicit).
Apps keep thin route files that render or re-export the package's: `<Basket />`,
`export { POST } from '@zeyolabs/shopping/checkout/webhook.server'`,
`export { productLoad as load } from '@zeyolabs/shopping/catalogue/loads.server'`.
Admin remote functions have no auth of their own: the app guards every admin route and remote call
(pureleaves does it in `apps/admin`'s hooks).

Stock: `products.stock` is in single units; `packSize` above 1 sells whole packs, and a combined
product (`product_components`, at most 10) has only the complete sets its components allow. `stock`
in catalogue and basket output is what can be sold now. `StockService.setStock` is the only write
path (it sets `restockedAt`); `paidStatements` is the paid decrement, in the same atomic batch as the
order items. Back-in-stock keys off `sellableSql`. Schema changes are additive; each app generates
its migration and applies it to prod D1 before deploying a version that uses it.
Signup form and checkout stay in the app (Turnstile / rate limiter): the product page takes an
`outOfStock` snippet, the basket page takes the app's `startCheckout` remote function.

Pages run in the browser too, so they cannot read the server config: the app's root layout calls
`setShopContext({ imageBaseUrl, siteName, siteUrl, supportEmail })`; anything else arrives as
data from a remote function or a `load`.

Tests sit next to the code. Service tests run on a real in-memory D1 (`__fixtures__/db.ts`, built
from `__fixtures__/schema.sql`, an app's generated migrations; regenerate it when the schema changes).

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
