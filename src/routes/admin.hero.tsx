import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Monitor, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import {
  DEFAULT_HERO_SETTINGS,
  MAX_DURATION,
  MAX_SLIDES,
  MIN_DURATION,
  TRANSITIONS,
  type HeroSettings,
  type HeroSlide,
  type HeroTransition,
} from "@/lib/hero";
import {
  heroErrorMessage,
  useAdminHero,
  useHeroCreate,
  useHeroDelete,
  useHeroReorder,
  useHeroSettingsSave,
  useHeroUpdate,
  type HeroUpdateInput,
} from "@/lib/hero-client";
import type { PreparedHeroImage } from "@/lib/hero-image";
import { HeroSlideCard } from "@/components/admin/hero/HeroSlideCard";
import { HeroUpload } from "@/components/admin/hero/HeroUpload";
import { HeroSlider } from "@/components/site/HeroSlider";
import heroInterior from "@/assets/hero-interior.jpg";

export const Route = createFileRoute("/admin/hero")({
  head: () => ({
    meta: [
      { title: "Hero Slider — Admin — Tallentire House" },
      {
        name: "description",
        content: "Manage the homepage hero images, order, timing and transitions.",
      },
      { property: "og:title", content: "Hero Slider — Admin — Tallentire House" },
      { property: "og:description", content: "Homepage hero management workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminHeroPage,
});

const PREVIEW_WIDTHS = { desktop: 1200, tablet: 820, mobile: 390 } as const;
type PreviewDevice = keyof typeof PREVIEW_WIDTHS;

function AdminHeroPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const enabled = !!user && isAdmin;

  const query = useAdminHero(enabled);
  const create = useHeroCreate();
  const update = useHeroUpdate();
  const remove = useHeroDelete();
  const reorder = useHeroReorder();
  const saveSettings = useHeroSettingsSave();

  const [order, setOrder] = useState<string[]>([]);
  const [settings, setSettings] = useState<HeroSettings>(DEFAULT_HERO_SETTINGS);
  const [preview, setPreview] = useState<PreviewDevice | null>(null);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!query.data) return;
    setSettings(query.data.settings);
    setOrder(query.data.slides.map((s) => s.id));
  }, [query.data]);

  const slides = useMemo<HeroSlide[]>(() => {
    const rows = query.data?.slides ?? [];
    if (order.length !== rows.length) return rows;
    const byId = new Map(rows.map((s) => [s.id, s]));
    return order.map((id) => byId.get(id)).filter((s): s is HeroSlide => !!s);
  }, [query.data, order]);

  const activeCount = slides.filter((s) => s.isActive).length;
  const busy =
    create.isPending ||
    update.isPending ||
    remove.isPending ||
    reorder.isPending ||
    saveSettings.isPending;

  const settingsDirty =
    !!query.data &&
    (query.data.settings.enabled !== settings.enabled ||
      query.data.settings.transition !== settings.transition ||
      query.data.settings.duration !== settings.duration);

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-20 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="font-display text-3xl">Admin role required</h1>
        <Link to="/" className="mt-6 inline-block">
          <Button variant="outline">Back to shop</Button>
        </Link>
      </div>
    );
  }

  async function handleUpload(prepared: PreparedHeroImage, replaceSlideId?: string) {
    try {
      await create.mutateAsync({
        replaceSlideId,
        altText: "",
        title: "",
        filename: prepared.filename,
        fileSize: prepared.fileSize,
        master: prepared.master,
        derivatives: prepared.derivatives,
      });
      toast.success(replaceSlideId ? "Image replaced" : "Hero slide added");
    } catch (err) {
      toast.error(heroErrorMessage(err));
      throw err;
    }
  }

  function patchSlide(patch: HeroUpdateInput) {
    update.mutate(patch, {
      onError: (err) => toast.error(heroErrorMessage(err)),
    });
  }

  function commitOrder(ids: string[]) {
    setOrder(ids);
    reorder.mutate(ids, {
      onSuccess: () => toast.success("Order saved"),
      onError: (err) => toast.error(heroErrorMessage(err)),
    });
  }

  const previewConfig = { settings, slides: slides.filter((s) => s.isActive) };

  return (
    <div className="mx-auto max-w-6xl px-6 lg:px-10 py-14">
      <p className="eyebrow text-foreground/60">Admin</p>
      <h1 className="mt-3 font-display text-4xl md:text-5xl">Hero Slider</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Manage the images, order, timing and transition effects displayed in the homepage Hero
        section.
      </p>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link to="/admin/products" className="underline underline-offset-4">
          Products dashboard
        </Link>
        <Link to="/admin/shipping" className="underline underline-offset-4">
          Shipping dashboard
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-secondary/30 px-5 py-4">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              settings.enabled && activeCount > 0 ? "bg-emerald-600" : "bg-muted-foreground/50"
            }`}
            aria-hidden
          />
          <span className="font-medium">
            {settings.enabled && activeCount > 0 ? "Active" : "Inactive"}
          </span>
          <span className="text-muted-foreground">
            · {activeCount} of {MAX_SLIDES} slides active
            {activeCount === 1 ? " (static hero image)" : activeCount > 1 ? " (slider)" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview("desktop")}>
            Preview Hero
          </Button>
          {busy && <Loader2 className="animate-spin text-muted-foreground" size={16} />}
        </div>
      </div>

      {/* SLIDES */}
      <section className="mt-10">
        <h2 className="eyebrow text-foreground/60">Slides</h2>
        {query.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading slides…</p>
        ) : slides.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No hero slides yet — the homepage is showing the built-in fallback image. Upload a
            1920 × 1080 image to take over the hero.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {slides.map((slide, i) => (
              <HeroSlideCard
                key={slide.id}
                slide={slide}
                position={i + 1}
                busy={busy}
                defaultDuration={settings.duration}
                defaultTransition={settings.transition}
                onUpdate={patchSlide}
                onDelete={() =>
                  remove.mutate(slide.id, {
                    onSuccess: () => toast.success("Slide deleted"),
                    onError: (err) => toast.error(heroErrorMessage(err)),
                  })
                }
                onReplace={(prepared) => handleUpload(prepared, slide.id)}
                dragHandlers={{
                  draggable: true,
                  onDragStart: () => {
                    dragId.current = slide.id;
                  },
                  onDragOver: (e) => e.preventDefault(),
                  onDrop: () => {
                    const from = dragId.current;
                    if (!from || from === slide.id) return;
                    const ids = slides.map((s) => s.id);
                    const next = ids.filter((id) => id !== from);
                    next.splice(ids.indexOf(slide.id), 0, from);
                    commitOrder(next);
                  },
                  onDragEnd: () => {
                    dragId.current = null;
                  },
                }}
              />
            ))}
          </ul>
        )}

        <div className="mt-6">
          {activeCount >= MAX_SLIDES ? (
            <p className="rounded-md border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
              You have the maximum of {MAX_SLIDES} active slides. Deactivate or delete one to add
              another.
            </p>
          ) : (
            <HeroUpload busy={busy} onPrepared={(p) => handleUpload(p)} />
          )}
        </div>
      </section>

      {/* SETTINGS */}
      <section className="mt-12 rounded-lg border border-border p-5">
        <h2 className="eyebrow text-foreground/60">Settings</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <Switch
              id="hero-enabled"
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
            />
            <Label htmlFor="hero-enabled">Hero slider enabled</Label>
          </div>
          <div>
            <Label className="text-xs">Default transition</Label>
            <Select
              value={settings.transition}
              onValueChange={(v) =>
                setSettings((s) => ({ ...s, transition: v as HeroTransition }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSITIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label} — {t.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs" htmlFor="hero-duration">
              Default duration (seconds)
            </Label>
            <Input
              id="hero-duration"
              type="number"
              min={MIN_DURATION}
              max={MAX_DURATION}
              step={1}
              value={settings.duration}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  duration: Math.min(
                    MAX_DURATION,
                    Math.max(MIN_DURATION, Math.round(Number(e.target.value) || MIN_DURATION)),
                  ),
                }))
              }
            />
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button
            disabled={!settingsDirty || busy}
            onClick={() =>
              saveSettings.mutate(settings, {
                onSuccess: () => toast.success("Hero settings published"),
                onError: (err) => toast.error(heroErrorMessage(err)),
              })
            }
          >
            Save changes
          </Button>
          {settingsDirty && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
        </div>
      </section>

      <Dialog open={preview !== null} onOpenChange={(o) => setPreview(o ? "desktop" : null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Hero preview</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            {(["desktop", "tablet", "mobile"] as PreviewDevice[]).map((d) => (
              <Button
                key={d}
                size="sm"
                variant={preview === d ? "default" : "outline"}
                onClick={() => setPreview(d)}
              >
                {d === "desktop" ? <Monitor size={15} /> : d === "tablet" ? <Tablet size={15} /> : <Smartphone size={15} />}
                <span className="capitalize">{d}</span>
              </Button>
            ))}
          </div>
          <div className="mx-auto w-full overflow-hidden rounded-md border border-border">
            <div
              className="mx-auto"
              style={{ maxWidth: preview ? PREVIEW_WIDTHS[preview] : PREVIEW_WIDTHS.desktop }}
            >
              <HeroSlider
                config={previewConfig}
                fallbackImage={heroInterior}
                fallbackAlt=""
                className="aspect-video"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
