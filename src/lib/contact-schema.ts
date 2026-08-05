import { z } from "zod";

/** Shared client/server contract for the contact form. */

export const MAX = {
  name: 100,
  email: 254,
  phone: 25,
  message: 3000,
} as const;

const NO_HTML = /^[^<>]*$/;
const PHONE_ALLOWED = /^[0-9+()\-/\s]*$/;

/** Removes any tag-like markup and control characters, preserving line breaks. */
export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/<|>/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

/** Escapes user input for safe inclusion in an HTML email body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Please enter your name.")
    .max(MAX.name, `Name must be ${MAX.name} characters or fewer.`)
    .regex(NO_HTML, "Name cannot contain HTML."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Please enter your email address.")
    .max(MAX.email, `Email must be ${MAX.email} characters or fewer.`)
    .email("Please enter a valid email address."),
  phone: z
    .string()
    .trim()
    .max(MAX.phone, `Phone must be ${MAX.phone} characters or fewer.`)
    .regex(PHONE_ALLOWED, "Phone can only contain numbers, spaces and ( ) - / +")
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Please write at least 10 characters.")
    .max(MAX.message, `Message must be ${MAX.message} characters or fewer.`)
    .regex(NO_HTML, "Message cannot contain HTML."),
});

export type ContactInput = z.infer<typeof contactSchema>;

/** Full submission payload including anti-spam signals. */
export const contactSubmissionSchema = contactSchema.extend({
  /** Invisible honeypot — must stay empty. */
  company: z.string().max(200).optional().or(z.literal("")),
  /** Client timestamp (ms) of when the form was rendered. */
  renderedAt: z.number().int().nonnegative(),
});

export type ContactSubmission = z.infer<typeof contactSubmissionSchema>;

export const MIN_FILL_SECONDS = 3;
