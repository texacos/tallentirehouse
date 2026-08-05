import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { submitContactMessage } from "@/lib/contact.functions";
import { contactSchema, MAX } from "@/lib/contact-schema";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Tallentire House" },
      {
        name: "description",
        content:
          "Get in touch with Tallentire House about products, orders or general enquiries. We reply to every message.",
      },
      { property: "og:title", content: "Contact — Tallentire House" },
      { property: "og:description", content: "Questions about products or orders? Send us a message." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contact,
});

type Fields = { name: string; email: string; phone: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = { name: "", email: "", phone: "", message: "" };

function Contact() {
  const send = useServerFn(submitContactMessage);
  const [values, setValues] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const renderedAt = useRef(0);

  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const parsed = contactSchema.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Fields;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const res = await send({
        data: {
          ...parsed.data,
          phone: parsed.data.phone ?? "",
          company: honeypot.current?.value ?? "",
          renderedAt: renderedAt.current,
        },
      });
      if (res.ok) {
        setSent(true);
        setValues(EMPTY);
      } else {
        setFormError(res.error);
      }
    } catch {
      setFormError("Sorry, we couldn't send your message just now. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-foreground";

  return (
    <div>
      <section className="mx-auto max-w-3xl px-6 py-20 lg:py-28 text-center">
        <p className="eyebrow text-foreground/60">Contact</p>
        <h1 className="mt-5 font-display text-5xl md:text-7xl leading-[0.95]">
          We'd love to <em className="text-clay">hear from you.</em>
        </h1>
        <p className="mt-8 text-base text-muted-foreground leading-relaxed">
          Questions about a piece, an order on its way, or something you'd like us to make —
          write to us and we'll reply as soon as we can.
        </p>
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-24 lg:pb-32">
        <div className="rule mb-14" />

        {sent ? (
          <div
            role="status"
            aria-live="polite"
            className="border border-border bg-secondary/40 px-6 py-10 text-center"
          >
            <p className="font-display text-2xl">Thank you!</p>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Your message has been sent successfully. We'll get back to you as soon as possible.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-8 text-xs uppercase tracking-[0.22em] underline underline-offset-4 hover:opacity-70"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-7">
            {/* Honeypot — hidden from users and assistive tech, filled only by bots. */}
            <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="company">Company</label>
              <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" ref={honeypot} />
            </div>

            <Field
              id="name"
              label="Full name"
              required
              error={errors.name}
              hint={`${values.name.length}/${MAX.name}`}
            >
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                maxLength={MAX.name}
                required
                value={values.name}
                onChange={set("name")}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "name-error" : undefined}
                className={inputClass}
              />
            </Field>

            <Field id="email" label="Email address" required error={errors.email}>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={MAX.email}
                required
                value={values.email}
                onChange={set("email")}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={inputClass}
              />
            </Field>

            <Field id="phone" label="Phone number" error={errors.phone} hint="Optional">
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={MAX.phone}
                value={values.phone}
                onChange={set("phone")}
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? "phone-error" : undefined}
                className={inputClass}
              />
            </Field>

            <Field
              id="message"
              label="Message"
              required
              error={errors.message}
              hint={`${values.message.length}/${MAX.message}`}
            >
              <textarea
                id="message"
                name="message"
                rows={7}
                maxLength={MAX.message}
                required
                value={values.message}
                onChange={set("message")}
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? "message-error" : undefined}
                className={`${inputClass} resize-y leading-relaxed`}
              />
            </Field>

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-3 bg-foreground px-8 py-5 text-xs uppercase tracking-[0.22em] text-background transition hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {submitting ? "Sending…" : "Send message"}
            </button>

            <p className="text-xs leading-relaxed text-muted-foreground">
              By submitting this form, you agree that we may use the information you provide to
              respond to your enquiry. Your information will never be sold or shared with third
              parties except where required to process your request.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="eyebrow text-foreground/70">
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
