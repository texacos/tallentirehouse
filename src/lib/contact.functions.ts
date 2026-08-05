import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import {
  contactSubmissionSchema,
  escapeHtml,
  stripHtml,
  MIN_FILL_SECONDS,
  type ContactSubmission,
} from "./contact-schema";

const CONTACT_TO = "carsten@tallentirehouse.com";
const RATE_LIMIT_WINDOW_MINUTES = 60;
const MAX_PER_IP = 5;
const MAX_PER_EMAIL = 3;

const GENERIC_ERROR =
  "Sorry, we couldn't send your message just now. Please try again in a moment.";

type Result = { ok: true } | { ok: false; error: string };

function clientIp(): string | null {
  const forwarded = getRequestHeader("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  return getRequestHeader("cf-connecting-ip")?.slice(0, 64) ?? null;
}

/** Same-origin check — server functions are same-origin RPC, so this blocks cross-site posts. */
function sameOrigin(): boolean {
  const host = getRequestHeader("host");
  const origin = getRequestHeader("origin");
  if (!origin) return true; // non-browser or same-origin fetch without Origin
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function buildEmailHtml(row: {
  name: string;
  email: string;
  phone: string;
  message: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}) {
  return `
    <h2>New Contact Form Submission</h2>
    <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
      <tr><td><strong>Name</strong></td><td>${escapeHtml(row.name)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${escapeHtml(row.email)}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${escapeHtml(row.phone || "—")}</td></tr>
      <tr><td valign="top"><strong>Message</strong></td><td><pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(
        row.message,
      )}</pre></td></tr>
      <tr><td><strong>Date &amp; Time</strong></td><td>${escapeHtml(row.createdAt)}</td></tr>
      <tr><td><strong>Sender IP</strong></td><td>${escapeHtml(row.ip || "unknown")}</td></tr>
      <tr><td><strong>User Agent</strong></td><td>${escapeHtml(row.userAgent || "unknown")}</td></tr>
    </table>
  `;
}

async function trySendEmail(html: string, replyTo: string) {
  const lovableKey = process.env['LOVABLE_API_KEY'];
  const resendKey = process.env['RESEND_API_KEY'];
  if (!lovableKey || !resendKey) return { sent: false, reason: "no_email_connection" };

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
        to: [CONTACT_TO],
        reply_to: replyTo,
        subject: "New Contact Form Submission",
        html,
      }),
    });
    if (!res.ok) {
      console.error(`[contact] email failed [${res.status}]`);
      return { sent: false, reason: `provider_${res.status}` };
    }
    return { sent: true, reason: "" };
  } catch (e) {
    console.error("[contact] email error", e);
    return { sent: false, reason: "exception" };
  }
}

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): ContactSubmission => contactSubmissionSchema.parse(data))
  .handler(async ({ data }): Promise<Result> => {
    if (!sameOrigin()) return { ok: false, error: GENERIC_ERROR };

    // Bot signals — respond as success-shaped failure without revealing the reason.
    if (data.company && data.company.length > 0) return { ok: true };
    if (Date.now() - data.renderedAt < MIN_FILL_SECONDS * 1000) {
      return { ok: false, error: "That was quick — please take a moment and try again." };
    }

    // Server-side sanitisation (never trust the client).
    const name = stripHtml(data.name).slice(0, 100);
    const email = stripHtml(data.email).toLowerCase().slice(0, 254);
    const phone = stripHtml(data.phone ?? "").slice(0, 25);
    const message = stripHtml(data.message).slice(0, 3000);
    if (!name || !email || message.length < 10) {
      return { ok: false, error: "Please check the form and try again." };
    }

    const ip = clientIp() ?? "";
    const userAgent = (getRequestHeader("user-agent") ?? "").slice(0, 300);

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();

      if (ip) {
        const { count } = await supabaseAdmin
          .from("contact_messages")
          .select("id", { count: "exact", head: true })
          .eq("ip", ip)
          .gte("created_at", since);
        if ((count ?? 0) >= MAX_PER_IP) {
          return { ok: false, error: "You've sent several messages recently. Please try again later." };
        }
      }

      const { count: emailCount } = await supabaseAdmin
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .gte("created_at", since);
      if ((emailCount ?? 0) >= MAX_PER_EMAIL) {
        return { ok: false, error: "You've sent several messages recently. Please try again later." };
      }

      // Persist first so a delivery failure never loses the enquiry.
      const { data: inserted, error } = await supabaseAdmin
        .from("contact_messages")
        .insert({ name, email, phone: phone || null, message, ip: ip || null, user_agent: userAgent })
        .select("id, created_at")
        .single();
      if (error) throw new Error(error.message);

      const html = buildEmailHtml({
        name,
        email,
        phone,
        message,
        ip,
        userAgent,
        createdAt: new Date(inserted.created_at).toUTCString(),
      });
      const sent = await trySendEmail(html, email);

      await supabaseAdmin
        .from("contact_messages")
        .update({
          email_status: sent.sent ? "sent" : "queued",
          email_error: sent.sent ? null : sent.reason,
          delivered_at: sent.sent ? new Date().toISOString() : null,
          attempts: 1,
        })
        .eq("id", inserted.id);

      return { ok: true };
    } catch (e) {
      console.error("[contact] submission error", e);
      return { ok: false, error: GENERIC_ERROR };
    }
  });
