// Admin server functions for the Web Orders dashboard.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AdminOrder = {
  id: string;
  order_number: string;
  status: string;
  fulfilment_status: string;
  is_test: boolean;
  currency: string;
  subtotal: number;
  shipping_amount: number;
  shipping_carrier_name: string;
  total: number;
  total_weight_kg: number;
  items_count: number;
  customer_name: string;
  email: string;
  phone: string;
  items: {
    product_name: string;
    sku: string;
    size: string;
    qty: number;
    unit_price: number;
    line_total: number;
  }[];
  billing_address: Record<string, string>;
  delivery_address: Record<string, string>;
  payment_intent_id: string | null;
  email_status: string;
  email_error: string | null;
  email_sent_at: string | null;
  internal_note: string;
  tracking_number: string;
  paid_at: string | null;
  created_at: string;
};

export type OrderStats = {
  ordersToday: number;
  paidRevenueMonth: number;
  pendingCount: number;
  pendingAmount: number;
};

const filtersSchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: z.string().trim().max(30).default("all"),
  mode: z.enum(["all", "test", "live"]).default("all"),
  from: z.string().trim().max(30).default(""),
  to: z.string().trim().max(30).default(""),
  page: z.number().int().min(1).max(1000).default(1),
  pageSize: z.number().int().min(5).max(200).default(25),
});

export type OrderFilters = z.infer<typeof filtersSchema>;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Permission check failed");
  if (!data) throw new Error("Not authorised");
}

export const adminListOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filtersSchema.parse(input ?? {}))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ rows: AdminOrder[]; total: number; stats: OrderStats; testMode: boolean }> => {
      const db = context.supabase as any;
      await assertAdmin(db, context.userId);

      let q = db.from("orders").select("*", { count: "exact" });
      if (data.status !== "all") q = q.eq("status", data.status);
      if (data.mode !== "all") q = q.eq("is_test", data.mode === "test");
      if (data.from) q = q.gte("created_at", new Date(data.from).toISOString());
      if (data.to) {
        const to = new Date(data.to);
        to.setUTCHours(23, 59, 59, 999);
        q = q.lte("created_at", to.toISOString());
      }
      if (data.search) {
        const s = data.search.replace(/[%,]/g, " ").trim();
        q = q.or(
          `order_number.ilike.%${s}%,customer_name.ilike.%${s}%,email.ilike.%${s}%`,
        );
      }
      const from = (data.page - 1) * data.pageSize;
      const { data: rows, count, error } = await q
        .order("created_at", { ascending: false })
        .range(from, from + data.pageSize - 1);
      if (error) throw new Error(error.message);

      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const startOfMonth = new Date();
      startOfMonth.setUTCDate(1);
      startOfMonth.setUTCHours(0, 0, 0, 0);

      const [todayRes, monthRes, pendingRes, settingRes] = await Promise.all([
        db
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("is_test", false)
          .gte("created_at", startOfDay.toISOString()),
        db
          .from("orders")
          .select("total")
          .eq("is_test", false)
          .eq("status", "paid")
          .gte("created_at", startOfMonth.toISOString()),
        db
          .from("orders")
          .select("id,total", { count: "exact" })
          .eq("is_test", false)
          .eq("status", "pending"),
        db.from("site_settings").select("value").eq("key", "ziina_test_mode").maybeSingle(),
      ]);

      const pendingTotal =
        Math.round(
          ((pendingRes.data ?? []) as { total: number }[]).reduce(
            (s, r) => s + Number(r.total ?? 0),
            0,
          ) * 100,
        ) / 100;

      return {
        rows: (rows ?? []) as AdminOrder[],
        total: count ?? 0,
        stats: {
          ordersToday: todayRes.count ?? 0,
          paidRevenueMonth:
            Math.round(
              ((monthRes.data ?? []) as { total: number }[]).reduce(
                (s, r) => s + Number(r.total ?? 0),
                0,
              ) * 100,
            ) / 100,
          pendingCount: pendingRes.count ?? 0,
          pendingAmount: pendingTotal,
        },
        testMode: settingRes.data ? Boolean(settingRes.data.value) : true,
      };
    },
  );

export const adminUpdateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        fulfilment_status: z.enum(["new", "processing", "shipped", "completed"]).optional(),
        internal_note: z.string().max(2000).optional(),
        tracking_number: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = context.supabase as any;
    await assertAdmin(db, context.userId);
    const { id, ...patch } = data;
    const { error } = await db.from("orders").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetTestMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ test: z.boolean() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = context.supabase as any;
    await assertAdmin(db, context.userId);
    const { error } = await db
      .from("site_settings")
      .upsert({ key: "ziina_test_mode", value: data.test }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResendOrderEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const db = context.supabase as any;
    await assertAdmin(db, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendOrderEmails } = await import("./checkout.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!order) return { ok: false };
    await sendOrderEmails(supabaseAdmin as never, { ...order, email_status: "resend" });
    return { ok: true };
  });
