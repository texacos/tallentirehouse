# Currencies dashboard — weekly USD/LKR rate

Yes, this is possible — and simpler than expected. I tested the Central Bank of Sri Lanka page: the "Submit" button posts to a results endpoint that can be called directly from the server, so no browser automation is needed. A live test just returned the real series (e.g. 2026-08-21 = 330.1657 LKR per 1 USD).

## What gets built

1. **Currencies dashboard** at `/admin/currencies` (admin-only, linked from the admin nav next to Orders/Shipping)
   - Big card: **Today's Exchange Rate USD/LKR** with the rate, the rate date from CBSL, and when it was last fetched.
   - **Refresh now** button for a manual fetch.
   - History table of previously fetched rates (date, rate, source, fetched at) with the last ~50 entries.
   - Clear error state if the last scheduled fetch failed.

2. **Automatic weekly fetch** — every Monday at 10:00 Sri Lanka time (UTC+05:30), i.e. `30 4 * * 1` UTC.

3. **Storage** — a new `currency_rates` table keeping one row per rate date, so history is preserved and re-runs don't duplicate.

## How it works (technical)

- **Database**: new table `public.currency_rates` (`base` USD, `quote` LKR, `rate_date`, `rate` numeric, `source`, `fetched_at`), unique on (base, quote, rate_date). Admin-only read via the existing `has_role` check; writes done server-side with the service role. Standard GRANTs + RLS as per project convention.
- **Fetcher** (`src/lib/currency.server.ts`): POSTs form data to
  `https://www.cbsl.gov.lk/cbsl_custom/exrates/exrates_results_spot_mid.php`
  with `rangeType=dates`, a 14-day window ending today, `chk_cur[]=USD~US Dollar`, `submit_button=Submit`; parses the results table and takes the most recent row (CBSL has no rate on weekends/holidays, so a window is used rather than a single date). Validates the value is a sane number before saving; upserts on the rate date.
- **Scheduled endpoint**: `src/routes/api/public/hooks/fetch-usd-lkr.ts` (POST), authenticated with the backend anon key in the `apikey` header, calling the fetcher. Scheduled with `pg_cron` + `pg_net` against the stable project URL at `30 4 * * 1`.
- **Admin server functions** (`src/lib/currency.functions.ts`): `adminListRates` and `adminRefreshRate`, both behind the existing admin auth middleware + role check.
- **UI**: `src/routes/admin.currencies.tsx`, built with the same card/table patterns as the Orders dashboard.

## Not included (say the word if you want it)

- Using the rate anywhere in the shop (prices stay USD only).
- Other currency pairs — the table design supports them, but only USD/LKR is wired up.
