# External integrations

The storefront is ready for server-side delivery and inventory integrations, but no provider credential is bundled in this project.

## Database (MongoDB)

The app stores everything (products, stock, orders, staff accounts, push subscriptions) in MongoDB. Set `MONGODB_URI` to a full MongoDB connection string (e.g. from MongoDB Atlas) and, optionally, `MONGODB_DB_NAME` (defaults to `nova_pharm`). `DATABASE_URL` is still accepted as a fallback name for the same value, for compatibility with existing hosting setups.

Without `MONGODB_URI`/`DATABASE_URL` set, the server automatically falls back to a local JSON file (`data/nova-local-data.json`) for development only. In production (`NODE_ENV=production`) the server refuses to start without a real MongoDB connection string, on purpose — the JSON fallback is not durable or fast enough for a live site.

IDs (`order.id`, `product.id`, `staffAccount.id`, …) stay plain, auto-incrementing numbers even though the storage is MongoDB — this is implemented with a small `counters` collection in `server/db.js`, so nothing in the app needed to change to numeric/ObjectId handling.

## Courier delivery flow

Orders move through: `new` → `preparing` → `ready` → `delivering` → `done` (or `cancelled`). Branch staff move an order from `new`/`preparing` to `ready` once it's packed; from there, any courier device can claim it (`ready` → `delivering`, atomically, so two couriers can't take the same order), then mark it `done` once delivered. Courier accounts (`role: "courier"`) are created from `/admin` just like branch devices, but aren't tied to a store — they see every branch's `ready` orders plus their own active delivery.

## New/ready-order alerts (Web Push)

Because a branch employee may not be looking at the Backoffice screen, and a courier may not have the site open at all, new/ready orders trigger two layers of alert:

1. **In-tab**: while the Backoffice tab is open, an escalating siren repeats every ~14s and the tab title flashes until someone actually opens the relevant section while the tab is visible.
2. **Web Push (OS-level notification)**: the server sends a push notification via VAPID/Web Push to every subscribed staff/courier device — this works even if the Backoffice tab is closed, as long as the browser/OS is running (works on Android Chrome and, since iOS 16.4+, on iPhones that added the site to the home screen). Generate a keypair once with:

   ```
   npx web-push generate-vapid-keys
   ```

   and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and optionally `VAPID_SUBJECT` (a `mailto:` contact) as server env vars. Without these set, push notifications are silently skipped and only the in-tab alert (layer 1) applies.

**Known limitation:** neither layer reaches a device that is fully powered off or has no signal at all. There is no SMS/Telegram fallback wired up — that would need a separate provider account (e.g. Twilio, a Telegram bot token) which isn't configured in this project.

## Moneyluxe inventory

The website can synchronize inventory only if Moneyluxe exposes an official API, webhook, or a reliable scheduled export. Set `MONEYLUXE_API_URL`, `MONEYLUXE_API_KEY`, and, if callbacks are supported, `MONEYLUXE_WEBHOOK_SECRET` on the server. The integration also needs a stable SKU/barcode mapping between Moneyluxe and the website.

The exact Moneyluxe endpoint paths, authentication method, response fields, branch identifier for the Mush pharmacy, and update frequency must be confirmed from Moneyluxe documentation or its support team. Until that information is available, the adapter deliberately does not invent stock values or endpoint contracts.

## Security rules

Keep all credentials server-side, rotate them if exposed, and never commit `.env` files. Use a staging account first, test one product and one order, then enable production synchronization. If Moneyluxe has no API or webhook, the practical alternative is a recurring CSV/Excel import with SKU validation; quantities cannot be safely changed in real time from the website without a supported data interface.
