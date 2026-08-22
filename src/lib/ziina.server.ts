// Server-only Ziina REST client. The API key never leaves the server.
const BASE = "https://api-v2.ziina.com/api";

export type ZiinaIntent = {
  id: string;
  status: string;
  redirect_url?: string | null;
  amount?: number;
  currency_code?: string;
  test?: boolean;
};

function apiKey(): string {
  const key = process.env["ZIINA_API_KEY"];
  if (!key) throw new Error("Ziina is not configured");
  return key;
}

async function call(path: string, init: RequestInit): Promise<ZiinaIntent> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[ziina] ${path} failed [${res.status}] ${text.slice(0, 500)}`);
    throw new Error("Payment provider error");
  }
  try {
    return JSON.parse(text) as ZiinaIntent;
  } catch {
    throw new Error("Unexpected payment provider response");
  }
}

export async function createPaymentIntent(input: {
  amountCents: number;
  currency: string;
  message: string;
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
  test: boolean;
}): Promise<ZiinaIntent> {
  return call("/payment_intent", {
    method: "POST",
    body: JSON.stringify({
      amount: input.amountCents,
      currency_code: input.currency,
      message: input.message.slice(0, 140),
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      failure_url: input.failureUrl,
      test: input.test,
      transaction_source: "directApi",
    }),
  });
}

export async function fetchPaymentIntent(id: string): Promise<ZiinaIntent> {
  return call(`/payment_intent/${encodeURIComponent(id)}`, { method: "GET" });
}

/** Maps Ziina intent status onto our order status. */
export function mapStatus(status: string): "pending" | "paid" | "failed" | "cancelled" {
  switch (status) {
    case "completed":
ȧ      return "paid";
    case "failed":
      return "failed";
    case "canceled":
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}
