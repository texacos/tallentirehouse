import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const RESTOCK_TO = "carsten@tallentirehouse.com";

const inputSchema = z.object({
  productSlug: z.string().trim().min(1).max(200),
  productName: z.string().trim().min(1).max(300),
  email: z.string().trim().toLowerCase().email().max(320),
});

async function trySendEmail(payload: {
  productSlug: string;
  productName: string;
  email: string;
}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) return { sent: false, reason: "no_resend_connection" };

  const html = `
    <h2>Restock request</h2>
    <p>A customer has requested that the following out-of-stock product be made again:</p>
    <ul>
      <li><strong>Product:</strong> ${payload.productName}</li>
      <li><strong>Product ID (slug):</strong> ${payload.productSlug}</li>
      <li><strong>Customer email:</strong> <a href="mailto:${payload.email}">${payload.email}</a></li>
    </ul>
    <p>Submitted from Tallentire House shop.</p>
  `;

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
        to: [RESTOCK_TO],
        reply_to: payload.email,
        subject: `Restock request: ${payload.productName}`,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[restock] Resend failed [${res.status}]: ${body}`);
      return { sent: false, reason: "resend_error" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[restock] send error", e);
    return { sent: false, reason: "exception" };
  }
}

export const submitRestockRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const url = process.env.SUPABASE_URL!;
    const supabase = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { error } = await supabase.from("restock_requests").insert({
      product_slug: data.productSlug,
      product_name: data.productName,
      email: data.email,
    });
    if (error) throw new Error(error.message);

    const emailResult = await trySendEmail(data);
    return { ok: true, emailSent: emailResult.sent };
  });
