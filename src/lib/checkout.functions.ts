// Thin server-function wrappers for the Ziina checkout.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const addressSchema = z.object({
  name: z.string().trim().max(120).default(""),
  line1: z.string().trim().max(200).default(""),
  line2: z.string().trim().max(200).default(""),
  city: z.string().trim().max(120).default(""),
  region: z.string().trim().max(120).default(""),
  postcode: z.string().trim().max(40).default(""),
  country: z.string().trim().max(120).default(""),
  email: z.string().trim().max(254).default(""),
  phone: z.string().trim().max(40).default(""),
});

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        slug: z.string().trim().min(1).max(200),
        size: z.string().trim().max(120).optional(),
        qty: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
  billing: addressSchema,
  delivery: addressSchema,
  carrierCode: z.string().trim().min(1).max(60),
});

export type CheckoutResult =
  | { ok: true; redirectUrl: string; orderNumber: string }
  | { ok: false; error: string };

function originUrl(): string {
  const origin = getRequestHeader("origin");
  if (origin) return origin.replace(/\/$/, "");
  const host = getRequestHeader("host") ?? "";
  return host ? `https://${host}` : "";
}

export const getCheckoutMode = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ test: boolean; configured: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isTestMode } = await import("./checkout.server");
    const test = await isTestMode(supabaseAdmin as never);
    return { test, configured: Boolean(process.env["ZIINA_API_KEY"]) };
  },
);

export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => checkoutSchema.parse(input))
  .handler(async ({ data }): Promise<CheckoutResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      priceBasket,
      isTestMode,
      shippingQuote,
      orderNumber,
    } = await import("./checkout.server");
    const { createPaymentIntent } = await import("./ziina.server");
    const db = supabaseAdmin as never;

    try {
      const { lines, subtotal, weightKg } = await priceBasket(db, data.items);

      const delivery = data.delivery.country ? data.delivery : data.billing;
      if (!delivery.country || !data.billing.email) {
        return { ok: false, error: "Please complete your address details." };
      }

      const { quote, carrierName, snapshot, message } = await shippingQuote(db, {
        country: delivery.country,
        city: delivery.city,
        weightKg,
        subtotal,
        carrierCode: data.carrierCode,
      });
      if (!quote || quote.status !== "rated") {
        return {
          ok: false,
          error:
            message ?? "That delivery method is not available for your address.",
        };
      }


      const shippingAmount = Math.round(quote.total * 100) / 100;
      const total = Math.round((subtotal + shippingAmount) * 100) / 100;
      if (total <= 0) return { ok: false, error: "Your basket total is invalid." };

      const test = await isTestMode(db);
      const number = orderNumber();

      const { data: order, error } = await supabaseAdmin
        .from("orders")
        .insert({
          order_number: number,
          status: "pending",
          is_test: test,
          currency: "USD",
          subtotal,
          shipping_amount: shippingAmount,
          shipping_carrier_code: data.carrierCode,
          shipping_carrier_name: carrierName,
          total,
          total_weight_kg: weightKg,
          billing_address: data.billing,
          delivery_address: delivery,
          customer_name: data.billing.name,
          email: data.billing.email.toLowerCase(),
          phone: data.billing.phone,
          items: lines,
          items_count: lines.reduce((s, l) => s + l.qty, 0),
        } as never)
        .select("id, order_number")
        .single();
      if (error) throw new Error(error.message);

      await supabaseAdmin.from("order_items").insert(
        lines.map((l) => ({ ...l, order_id: (order as never as { id: string }).id })) as never,
      );

      const base = originUrl();
      const returnUrl = `${base}/checkout/return?order=${encodeURIComponent(number)}`;
      const intent = await createPaymentIntent({
        amountCents: Math.round(total * 100),
        currency: "USD",
        message: `Tallentire House order ${number}`,
        successUrl: returnUrl,
        cancelUrl: `${returnUrl}&cancelled=1`,
        failureUrl: `${returnUrl}&failed=1`,
        test,
      });

      await supabaseAdmin
        .from("orders")
        .update({
          payment_intent_id: intent.id,
          payment_redirect_url: intent.redirect_url ?? null,
        } as never)
        .eq("id", (order as never as { id: string }).id);

      if (!intent.redirect_url) {
        return { ok: false, error: "The payment page could not be opened. Please try again." };
      }
      return { ok: true, redirectUrl: intent.redirect_url, orderNumber: number };
    } catch (e) {
      console.error("[checkout] create failed", e);
      const message = e instanceof Error ? e.message : "Checkout failed";
      return { ok: false, error: message };
    }
  });

export type OrderSummary = {
  orderNumber: string;
  status: string;
  isTest: boolean;
  subtotal: number;
  shipping: number;
  total: number;
  carrierName: string;
  items: { name: string; size: string; qty: number; lineTotal: number }[];
};

export const finalizeCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: { orderNumber: string }) => ({
    orderNumber: String(input?.orderNumber ?? "").trim().slice(0, 40),
  }))
  .handler(async ({ data }): Promise<OrderSummary | null> => {
    if (!data.orderNumber) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { settleOrder } = await import("./checkout.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (!order) return null;

    let status = (order as never as { status: string }).status;
    try {
      status = (await settleOrder(supabaseAdmin as never, order)).status;
    } catch (e) {
      console.error("[checkout] settle failed", e);
    }

    const o = order as never as Record<string, any>;
    return {
      orderNumber: o["order_number"],
      status,
      isTest: Boolean(o["is_test"]),
      subtotal: Number(o["subtotal"]),
      shipping: Number(o["shipping_amount"]),
      total: Number(o["total"]),
      carrierName: o["shipping_carrier_name"] ?? "",
      items: (Array.isArray(o["items"]) ? o["items"] : []).map((l: any) => ({
        name: String(l.product_name ?? ""),
        size: String(l.size ?? ""),
        qty: Number(l.qty ?? 0),
        lineTotal: Number(l.line_total ?? 0),
      })),
    };
  });
