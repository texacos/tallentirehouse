// Row mapping + settings persistence for the Hero Slider (server-only).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_HERO_SETTINGS,
  HERO_SETTINGS_KEY,
  clampDuration,
  isTransition,
  type HeroSettings,
  type HeroSlide,
  type HeroVariant,
} from "./hero";

type Db = SupabaseClient<any, any, any>;

export function loose(client: unknown): Db {
  return client as Db;
}

export const SLIDE_COLUMNS =
  "id,base_path,master_path,variants,alt_text,title,is_active,sort_order,display_duration,transition,width,height,mime_type,file_size,original_filename,created_at,updated_at";

export function mapSlide(row: Record<string, unknown>): HeroSlide {
  const rawVariants = Array.isArray(row["variants"]) ? row["variants"] : [];
  const variants = rawVariants
    .map((v) => v as Record<string, unknown>)
    .filter((v) => typeof v["path"] === "string" && typeof v["mime"] === "string")
    .map<HeroVariant>((v) => ({
      w: Number(v["w"] ?? 0),
      h: Number(v["h"] ?? 0),
      path: String(v["path"]),
      mime: String(v["mime"]),
      bytes: Number(v["bytes"] ?? 0),
    }));
  const transition = row["transition"];
  return {
    id: String(row["id"]),
    title: String(row["title"] ?? ""),
    altText: String(row["alt_text"] ?? ""),
    isActive: Boolean(row["is_active"]),
    sortOrder: Number(row["sort_order"] ?? 0),
    duration: row["display_duration"] == null ? null : clampDuration(row["display_duration"]),
    transition: isTransition(transition) ? transition : null,
    width: Number(row["width"] ?? 0),
    height: Number(row["height"] ?? 0),
    mimeType: String(row["mime_type"] ?? ""),
    fileSize: Number(row["file_size"] ?? 0),
    originalFilename: (row["original_filename"] as string | null) ?? null,
    masterPath: String(row["master_path"] ?? ""),
    variants,
    createdAt: String(row["created_at"] ?? ""),
    updatedAt: String(row["updated_at"] ?? ""),
  };
}

export function parseSettings(value: unknown): HeroSettings {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    enabled: typeof v["enabled"] === "boolean" ? v["enabled"] : DEFAULT_HERO_SETTINGS.enabled,
    transition: isTransition(v["transition"]) ? v["transition"] : DEFAULT_HERO_SETTINGS.transition,
    duration: clampDuration(v["duration"] ?? DEFAULT_HERO_SETTINGS.duration),
  };
}

export async function readSettings(db: Db): Promise<HeroSettings> {
  const { data } = await db
    .from("site_settings")
    .select("value")
    .eq("key", HERO_SETTINGS_KEY)
    .maybeSingle();
  return parseSettings(data?.value);
}

export async function writeSettings(db: Db, settings: HeroSettings): Promise<HeroSettings> {
  const clean = parseSettings(settings);
  const { error } = await db
    .from("site_settings")
    .upsert({ key: HERO_SETTINGS_KEY, value: clean }, { onConflict: "key" });
  if (error) throw new Error("Could not save the Hero Slider settings.");
  return clean;
}

/** Number of currently active slides, optionally excluding one id. */
export async function countActive(db: Db, exceptId?: string): Promise<number> {
  let q = db.from("hero_slides").select("id", { count: "exact", head: true }).eq("is_active", true);
  if (exceptId) q = q.neq("id", exceptId);
  const { count } = await q;
  return count ?? 0;
}

export async function nextSortOrder(db: Db): Promise<number> {
  const { data } = await db
    .from("hero_slides")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  const top = Array.isArray(data) && data.length ? Number(data[0]?.sort_order ?? 0) : 0;
  return top + 1;
}
