// Server-only checkout helpers: pricing, order creation and settlement.
import type { SupabaseClient } from "@supabase/supabase-js";
import { quoteShippingFor } from "./shipping-quote.server";
import { fetchPaymentIntent, mapStatus } from "./ziina.server";

type Db = SupabaseClient<any, any, any>;

export type CheckoutAddress = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  email: string;
  phone: string;
};

export type CheckoutLine = {
  product_id: string | null;
  product_slug: string;
  product_name: string;
  sku: string;
  size: string;
  qty: number;
  unit_price: number;
  line_total: number;
  weight_kg: number;
};

const money = (n: number) => Math.round(n * 100) / 100;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function orderNumber(): string {
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}`.slice(2) +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TH-${stamp}-${rand}`;
}

/** Re-prices the basket from the database. Never trusts browser totals. */
export async function priceBasket(
  db: Db,
  items: { slug: string; size?: string; qty: number }[],
): Promise<{ lines: CheckoutLine[]; subtotal: number; weightKg: number }> {
  const slugs = [...new Set(items.map((i) => i.slug))];
  const { data, error } = await db
    .from("products")
    .select("id,slug,name,sku,price,weight_kg,stock,variants")
    .in("slug", slugs);
  if (error) throw new Error(error.message);
  const bySlug = new Map<string, any>((data ?? []).map((p: any) => [p.slug, p]));

  const lines: CheckoutLine[] = [];
  for (const item of items) {
    const p = bySlug.get(item.slug);
    if (!p) throw new Error(`A product in your basket is no longer available.`);
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const variant = item.size ? variants.find((v: any) => v?.size === item.size) : undefined;
    if (variants.length > 0 && !variant) {
      throw new Error(`Please re-select a size for ${p.name}.`);
    }
    const stock = Math.max(0, Number(variant ? variant.stock : p.stock) || 0);
    if (item.qty > stock) {
      throw new Error(
        stock === 0
          ? `${p.name} is out of stock.`
          : `Only ${stock} of ${p.name} left in stock.`,
      );
    }
    const unit = money(Number(variant?.price ?? p.price) || 0);
    const weight = Number(variant?.weight_kg ?? p.weight_kg) || 0;
    lines.push({
      product_id: p.id as string,
      product_slug: p.slug as string,
      product_name: p.name as string,
      sku: String(variant?.sku || p.sku || ""),
      size: item.size ?? "",
      qty: item.qty,
      unit_price: unit,
      line_total: money(unit * item.qty),
      weight_kg: weight,
    });
  }

  const subtotal = money(lines.reduce((s, l) => s + l.line_total, 0));
  const weightKg =
    Math.round(lines.reduce((s, l) => s + l.weight_kg * l.qty, 0) * 1000) / 1000;
  return { lines, subtotal, weightKg };
}

export async function isTestMode(db: Db): Promise<boolean> {
  const { data } = await db
    .from("site_settings")
    .select("value")
    .eq("key", "ziina_test_mode")
    .maybeSingle();
  if (!data) return true; // safe default until the admin switches to live
  return Boolean((data as any).value);
}

export async function shippingQuote(
  db: Db,
  args: { country: string; weightKg: number; subtotal: number; carrierCode: string },
) {
  return quoteShippingFor(db, args);
}

/** Applies stock once, when a payment is confirmed. */
export async function applyStock(db: Db, order: any): Promise<void> {
  if (order.stock_applied) return;
  const lines = (Array.isArray(order.items) ? order.items : []) as CheckoutLine[];
  for (const line of lines) {
    const { data: p } = await db
      .from("products")
      .select("id,stock,variants")
      .eq("slug", line.product_slug)
      .maybeSingle();
    if (!p) continue;
    const variants = Array.isArray((p as any).variants) ? [...(p as any).variants] : [];
    if (line.size && variants.length > 0) {
      const idx = variants.findIndex((v: any) => v?.size === line.size);
      if (idx >= 0) {
        variants[idx] = {
          ...variants[idx],
          stock: Math.max(0, Number(variants[idx].stock ?? 0) - line.qty),
        };
        await db.from("products").update({ variants }).eq("id", (p as any).id);
      }
    } else {
      const next = Math.max(0, Number((p as any).stock ?? 0) - line.qty);
      await db.from("products").update({ stock: next }).eq("id", (p as any).id);
    }
  }
  await db.from("orders").update({ stock_applied: true }).eq("id", order.id);
}

function addressHtml(a: CheckoutAddress | Record<string, unknown>): string {
  const v = (k: string) => escapeHtml(String((a as any)?.[k] ?? ""));
  return [v("name"), v("line1"), v("line2"), v("city"), v("region"), v("postcode"), v("country")]
    .filter(Boolean)
    .join("<br/>");
}

export function orderEmailHtml(order: any): string {
  const lines = (Array.isArray(order.items) ? order.items : []) as CheckoutLine[];
  const rows = lines
    .map(
      (l) => `<tr>
        <td>${escapeHtml(l.product_name)}${l.size ? ` <em>(${escapeHtml(l.size)})</em>` : ""}<br/><small>${escapeHtml(l.sku)}</small></td>
        <td align="center">${l.qty}</td>
        <td align="right">$${l.line_total.toFixed(2)}</td>
      </tr>`,
    )
    .join("");
  return `
    <div style="font-family:Georgia,serif;font-size:14px;color:#222">
      <h2>Thank you for your order</h2>
      <p>Order <strong>${escapeHtml(order.order_number)}</strong>${order.is_test ? " (TEST)" : ""}</p>
      <table cellpadding="8" style="border-collapse:collapse;width:100%">
        <thead><tr><th align="left">Item</th><th>Qty</th><th align="right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p>
        Subtotal: $${Number(order.subtotal).toFixed(2)}<br/>
        Shipping (${escapeHtml(order.shipping_carrier_name || "—")}): $${Number(order.shipping_amount).toFixed(2)}<br/>
        <strong>Total: $${Number(order.total).toFixed(2)}</strong>
      </p>
      <h3>Delivery address</h3>
      <p>${addressHtml(order.delivery_address)}</p>
      <h3>Billing address</h3>
      <p>${addressHtml(order.billing_address)}</p>
      <p>Tallentire House — Fabrics for Life</p>
    </div>
  `;
}

export async function sendOrderEmails(
  db: Db,
  order: any,
): Promise<void> {
  if (order.email_status === "sent") return;
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  const html = orderEmailHtml(order);
  const subject = `Order ${order.order_number} confirmed${order.is_test ? " (test)" : ""}`;

  if (!lovableKey || !resendKey) {
    await db
      .from("orders")
      .update({ email_status: "queued", email_error: "no_email_connection" })
      .eq("id", order.id);
    return;
  }

  const to = [order.email, "info@tallentirehouse.com"].filter(Boolean);
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: "Tallentire House <onboarding@resend.dev>",
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      await db
        .from("orders")
        .update({
          email_status: "failed",
          email_error: `provider_${res.status}`,
          email_attempts: Number(order.email_attempts ?? 0) + 1,
        })
        .eq("id", order.id);
      return;
    }
    await db
      .from("orders")
      .update({
        email_status: "sent",
        email_error: null,
        email_sent_at: new Date().toISOString(),
        email_attempts: Number(order.email_attempts ?? 0) + 1,
      })
      .eq("id", order.id);
  } catch (e) {
    console.error("[checkout] email error", e);
    await db
      .from("orders")
      .update({
        email_status: "failed",
        email_error: "exception",
        email_attempts: Number(order.email_attempts ?? 0) + 1,
      })
      .eq("id", order.id);
  }
}

/** Idempotent settlement used by both the return page and the webhook. */
export async function settleOrder(
  db: Db,
  order: any,
): Promise<{ status: string }> {
  if (!order.payment_intent_id) return { status: order.status };
  if (order.status === "paid") return { status: "paid" };

  const intent = await fetchPaymentIntent(order.payment_intent_id);
  const status = mapStatus(intent.status ?? "");
  if (status === order.status) return { status };

  await db
    .from("orders")
    .update({
      status,
      paid_at: status === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", order.id);

  if (status === "paid") {
    const fresh = { ...order, status, stock_applied: order.stock_applied };
    await applyStock(db, fresh);
    await sendOrderEmails(db, fresh);
  }
  return { status };
}
