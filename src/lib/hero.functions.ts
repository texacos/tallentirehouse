// Thin server-function wrappers for the Hero Slider.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_SLIDES,
  MIN_DURATION,
  MAX_DURATION,
  type HeroConfig,
  type HeroSettings,
  type HeroSlide,
} from "./hero";
import { assertAdmin } from "./admin-products.server";
import {
  SLIDE_COLUMNS,
  countActive,
  loose,
  mapSlide,
  nextSortOrder,
  parseSettings,
  readSettings,
  writeSettings,
} from "./hero-rows.server";
import {
  HeroError,
  assertUuid,
  removeSlideAssets,
  storeSlideAssets,
} from "./hero.server";

const assetSchema = z.object({
  w: z.number().int().min(1).max(4000),
  h: z.number().int().min(1).max(4000),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(16).max(20_000_000),
});

const createSchema = z.object({
  replaceSlideId: z.string().uuid().optional(),
  altText: z.string().max(200).default(""),
  title: z.string().max(120).default(""),
  filename: z.string().max(255).default(""),
  fileSize: z.number().int().min(1),
  master: assetSchema,
  derivatives: z.array(assetSchema).min(1).max(12),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(120).optional(),
  altText: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
  duration: z.number().int().min(MIN_DURATION).max(MAX_DURATION).nullable().optional(),
  transition: z.enum(["dissolve", "slide", "zoom"]).nullable().optional(),
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  transition: z.enum(["dissolve", "slide", "zoom"]),
  duration: z.number().int().min(MIN_DURATION).max(MAX_DURATION),
});

/** Public homepage read — anon SELECT policy, safe during SSR/prerender. */
export const getHeroConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<HeroConfig> => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const db = loose(
      createClient(process.env["SUPABASE_URL"]!, key, {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      }),
    );
    try {
      const [{ data: slides }, settings] = await Promise.all([
        db
          .from("hero_slides")
          .select(SLIDE_COLUMNS)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(MAX_SLIDES),
        readSettings(db),
      ]);
      return { settings, slides: (slides ?? []).map(mapSlide) };
    } catch {
      // A broken hero configuration must never break the homepage.
      return { settings: parseSettings(null), slides: [] };
    }
  },
);

export const adminHeroList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HeroConfig> => {
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    const { data, error } = await db
      .from("hero_slides")
      .select(SLIDE_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error("Could not load the hero slides.");
    return { settings: await readSettings(db), slides: (data ?? []).map(mapSlide) };
  });

export const adminHeroCreate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }): Promise<HeroSlide> => {
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);

    const replacing = data.replaceSlideId ? assertUuid(data.replaceSlideId) : null;
    let previous: Record<string, unknown> | null = null;
    if (replacing) {
      const { data: row } = await db
        .from("hero_slides")
        .select(SLIDE_COLUMNS)
        .eq("id", replacing)
        .maybeSingle();
      if (!row) throw new HeroError("That slide no longer exists.");
      previous = row as Record<string, unknown>;
    } else if ((await countActive(db)) >= MAX_SLIDES) {
      throw new HeroError(
        `The hero slider already has ${MAX_SLIDES} active slides. Deactivate or delete one first.`,
      );
    }

    const slideId = crypto.randomUUID();
    const stored = await storeSlideAssets(db, slideId, data.master, data.derivatives);
    const values = {
      base_path: stored.basePath,
      master_path: stored.masterPath,
      variants: stored.variants,
      width: 1920,
      height: 1080,
      mime_type: data.master.mime,
      file_size: data.fileSize,
      original_filename: data.filename.slice(0, 255) || null,
    };

    try {
      if (previous) {
        // Replace: only after the new assets exist do we point the row at them.
        const { data: updated, error } = await db
          .from("hero_slides")
          .update(values)
          .eq("id", replacing!)
          .select(SLIDE_COLUMNS)
          .single();
        if (error) throw new HeroError("Could not update the slide.");
        await removeSlideAssets(db, String(previous["base_path"])).catch(() => undefined);
        return mapSlide(updated as Record<string, unknown>);
      }
      const { data: inserted, error } = await db
        .from("hero_slides")
        .insert({
          id: slideId,
          ...values,
          alt_text: data.altText,
          title: data.title,
          is_active: true,
          sort_order: await nextSortOrder(db),
        })
        .select(SLIDE_COLUMNS)
        .single();
      if (error) throw new HeroError("Could not save the slide.");
      return mapSlide(inserted as Record<string, unknown>);
    } catch (err) {
      await removeSlideAssets(db, stored.basePath).catch(() => undefined);
      throw err;
    }
  });

export const adminHeroUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }): Promise<HeroSlide> => {
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    if (data.isActive === true && (await countActive(db, data.id)) >= MAX_SLIDES) {
      throw new HeroError(`Only ${MAX_SLIDES} slides can be active at once.`);
    }
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.altText !== undefined) patch["alt_text"] = data.altText;
    if (data.isActive !== undefined) patch["is_active"] = data.isActive;
    if (data.duration !== undefined) patch["display_duration"] = data.duration;
    if (data.transition !== undefined) patch["transition"] = data.transition;
    const { data: row, error } = await db
      .from("hero_slides")
      .update(patch)
      .eq("id", data.id)
      .select(SLIDE_COLUMNS)
      .single();
    if (error || !row) throw new HeroError("Could not update the slide.");
    return mapSlide(row as Record<string, unknown>);
  });

export const adminHeroReorder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    for (const [index, id] of data.ids.entries()) {
      const { error } = await db
        .from("hero_slides")
        .update({ sort_order: index + 1 })
        .eq("id", id);
      if (error) throw new HeroError("Could not save the new order.");
    }
    return { ok: true };
  });

export const adminHeroDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    const { data: row } = await db
      .from("hero_slides")
      .select("base_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: true };
    const { error } = await db.from("hero_slides").delete().eq("id", data.id);
    if (error) throw new HeroError("Could not delete the slide.");
    await removeSlideAssets(db, String((row as Record<string, unknown>)["base_path"])).catch(
      () => undefined,
    );
    return { ok: true };
  });

export const adminHeroSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }): Promise<HeroSettings> => {
    const db = loose(context.supabase);
    await assertAdmin(db, context.userId);
    return writeSettings(db, data);
  });
