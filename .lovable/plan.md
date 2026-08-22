# Ziina Payments + Orders

Turn the current preview checkout into a real payment flow using Ziina Payment Intents (USD), with full order records, an admin test-mode toggle, and confirmation emails.

## Customer flow

1. Basket → billing/delivery address → delivery method (unchanged).
2. "Proceed to checkout" now:
   - Re-validates stock, re-prices the basket and re-quotes shipping on the server (never trusts browser totals).
   - Creates an order record with status `pending`.
   - Creates a Ziina Payment Intent (`currency_code: "USD"`, amount in cents, `test` flag from settings) and redirects the buyer to Ziina's hosted payment page.
3. Ziina returns the buyer to `/checkout/return?order=…`:
   - The server re-fetches the payment intent from Ziina and updates the order to `paid`, `failed`, or `cancelled`.
   - Paid → thank-you page with order number and summary; stock is decremented once, and confirmation emails go out.
   - Failed/cancelled → clear message and a link back to the basket with the cart intact.
4. A Ziina webhook endpoint provides the same status update independently of the browser, so an abandoned tab still records the correct outcome. Both paths are idempotent — whichever lands first wins.

## Orders in the backend

New `public.orders` table holding: order number, status, payment provider/intent id, test flag, currency, subtotal, shipping amount, carrier, total, billing address, delivery address, contact email/phone, line-item snapshot (name, SKU, size, qty, unit price, weight), timestamps, and email-delivery status. Plus `public.order_items` for queryable lines.

Access rules: no public read or write. Rows are created and updated only by server functions and the webhook handler; admins can read them.

## Test mode

A `payments` entry in `site_settings` with a "Ziina test mode" switch, shown in the admin dashboard alongside the other global settings. When on, every intent is created with `test=true` and the checkout page shows a small "Test mode — no real money will be charged" notice. Orders record which mode they were made in so test orders are distinguishable.

## Emails

On a confirmed payment, the existing Resend setup sends:
- Order confirmation to the buyer (items, totals, delivery method and address).
- Copy to info@tallentirehouse.com.

Sending is attempted once per order, with the result stored on the order so it can be retried without duplicating.

## Security

- The Ziina API key is stored as a backend secret and used only server-side with an `Authorization: Bearer` header; it never reaches the browser.
- Amounts, shipping and stock are recomputed server-side at intent creation.
- The webhook route lives under `/api/public/` and verifies the request before touching any order; unverified calls are rejected.
- The return page trusts the Ziina API response, not URL parameters.

## Technical notes

- `src/lib/ziina.server.ts` — thin Ziina REST client (create intent, fetch intent), reads `ZIINA_API_KEY` inside handlers.
- `src/lib/checkout.functions.ts` — `createCheckout` (validate, price, insert order, create intent, return redirect URL) and `finalizeCheckout` (fetch intent, settle order, decrement stock, send emails).
- `src/routes/api/public/ziina-webhook.ts` — server route for status callbacks.
- `src/routes/checkout.return.tsx` — post-payment landing page.
- `src/routes/cart.tsx` — swap the fake `setPlaced(true)` for the real call.
- Migration adds `orders` / `order_items` with GRANTs, RLS and admin-only read policies.

## What I need from you

- The Ziina API key (I'll request it through the secure secret prompt when we start).
- Confirmation that your Ziina account's success/cancel redirect back to the site can be set per intent (the API accepts them per request, so no dashboard step is expected).
