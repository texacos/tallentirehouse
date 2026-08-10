// Shared, browser-safe types and helpers for the Hero Slider.

export const HERO_WIDTH = 1920;
export const HERO_HEIGHT = 1080;
export const HERO_WIDTHS = [640, 960, 1280, 1920] as const;
export const MAX_SLIDES = 10;
export const MIN_DURATION = 2;
export const MAX_DURATION = 15;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const TRANSITIONS = [
  { value: "dissolve", label: "Dissolve", hint: "Smooth cross-fade" },
  { value: "slide", label: "Slide", hint: "Subtle horizontal slide" },
  { value: "zoom", label: "Gentle Zoom", hint: "Restrained Ken Burns + fade" },
] as const;

export type HeroTransition = (typeof TRANSITIONS)[number]["value"];

export type HeroVariant = {
  w: number;
  h: number;
  path: string;
  mime: string;
  bytes: number;
};

export type HeroSlide = {
  id: string;
  title: string;
  altText: string;
  isActive: boolean;
  sortOrder: number;
  duration: number | null;
  transition: HeroTransition | null;
  width: number;
  height: number;
  mimeType: string;
  fileSize: number;
  originalFilename: string | null;
  masterPath: string;
  variants: HeroVariant[];
  createdAt: string;
  updatedAt: string;
};

export type HeroSettings = {
  enabled: boolean;
  transition: HeroTransition;
  duration: number;
};

export type HeroConfig = {
  settings: HeroSettings;
  slides: HeroSlide[];
};

export const DEFAULT_HERO_SETTINGS: HeroSettings = {
  enabled: true,
  transition: "dissolve",
  duration: 5,
};

export const HERO_SETTINGS_KEY = "hero_slider";

/** Public, cacheable URL for a stored hero asset. */
export function heroUrl(path: string): string {
  return `/api/public/hero-images/${path}`;
}

export function isTransition(v: unknown): v is HeroTransition {
  return TRANSITIONS.some((t) => t.value === v);
}

export function clampDuration(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return DEFAULT_HERO_SETTINGS.duration;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, n));
}

export function variantsOfType(slide: HeroSlide, mime: string): HeroVariant[] {
  return slide.variants
    .filter((v) => v.mime === mime)
    .sort((a, b) => a.w - b.w);
}

export function srcSetOf(slide: HeroSlide, mime: string): string {
  return variantsOfType(slide, mime)
    .map((v) => `${heroUrl(v.path)} ${v.w}w`)
    .join(", ");
}

/** Largest JPEG derivative (the universal fallback `src`). */
export function fallbackSrc(slide: HeroSlide): string {
  const jpegs = variantsOfType(slide, "image/jpeg");
  const largest = jpegs[jpegs.length - 1];
  return heroUrl(largest ? largest.path : slide.masterPath);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
