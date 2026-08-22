// Server-only fetcher for the CBSL indicative USD/LKR spot exchange rate.
// The public page's "Submit" button posts to this endpoint, so we call it
// directly instead of driving a headless browser.

const CBSL_ENDPOINT =
  "https://www.cbsl.gov.lk/cbsl_custom/exrates/exrates_results_spot_mid.php";
export const CBSL_SOURCE = "cbsl.gov.lk";

export type ScrapedRate = {
  rateDate: string; // yyyy-mm-dd
  rate: number; // LKR per 1 USD
  inverseRate: number | null;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Fetches the most recent published USD/LKR spot rate (looks back 14 days). */
export async function scrapeUsdLkrRate(): Promise<ScrapedRate> {
  const end = new Date();
  const start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);

  const body = new URLSearchParams();
  body.append("rangeType", "dates");
  body.append("txtStart", ymd(start));
  body.append("txtEnd", ymd(end));
  body.append("rangeValue", "1");
  body.append("chk_cur[]", "USD~US Dollar");
  body.append("submit_button", "Submit");

  const res = await fetch(CBSL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (compatible; TallentireHouseBot/1.0)",
      Accept: "text/html",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`CBSL request failed with status ${res.status}`);
  }

  const html = await res.text();
  return parseCbslHtml(html);
}

/** Parses the results table: rows of `date | USD->LKR | LKR->USD`. */
export function parseCbslHtml(html: string): ScrapedRate {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");

  const rowRe = /(\d{4}-\d{2}-\d{2})\s+([\d,]+\.\d+)\s+([\d,]*\.?\d+)?/g;
  const rows: ScrapedRate[] = [];
  for (const m of text.matchAll(rowRe)) {
    const rate = Number(m[2]!.replace(/,/g, ""));
    const inverse = m[3] ? Number(m[3].replace(/,/g, "")) : NaN;
    if (!Number.isFinite(rate) || rate <= 0 || rate > 100000) continue;
    rows.push({
      rateDate: m[1]!,
      rate,
      inverseRate: Number.isFinite(inverse) && inverse > 0 ? inverse : null,
    });
  }

  if (rows.length === 0) {
    throw new Error("No USD/LKR rate found in the CBSL response");
  }

  rows.sort((a, b) => (a.rateDate < b.rateDate ? 1 : -1));
  return rows[0]!;
}

export type RefreshResult = {
  ok: true;
  rateDate: string;
  rate: number;
  fetchedAt: string;
};

/** Scrapes and upserts the latest rate. Safe to run repeatedly. */
export async function refreshUsdLkrRate(): Promise<RefreshResult> {
  const scraped = await scrapeUsdLkrRate();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const fetchedAt = new Date().toISOString();

  const { error } = await (supabaseAdmin as any).from("currency_rates").upsert(
    {
      base: "USD",
      quote: "LKR",
      rate_date: scraped.rateDate,
      rate: scraped.rate,
      inverse_rate: scraped.inverseRate,
      source: CBSL_SOURCE,
      fetched_at: fetchedAt,
      updated_at: fetchedAt,
    },
    { onConflict: "base,quote,rate_date" },
  );

  if (error) throw new Error(`Could not save rate: ${error.message}`);

  return { ok: true, rateDate: scraped.rateDate, rate: scraped.rate, fetchedAt };
}
