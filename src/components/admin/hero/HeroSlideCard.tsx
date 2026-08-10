import { useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MAX_DURATION,
  MIN_DURATION,
  TRANSITIONS,
  fallbackSrc,
  formatBytes,
  type HeroSlide,
  type HeroTransition,
} from "@/lib/hero";
import type { HeroUpdateInput } from "@/lib/hero-client";
import type { PreparedHeroImage } from "@/lib/hero-image";
import { HeroUpload } from "./HeroUpload";

export function HeroSlideCard({
  slide,
  position,
  defaultDuration,
  defaultTransition,
  busy,
  onUpdate,
  onDelete,
  onReplace,
  dragHandlers,
}: {
  slide: HeroSlide;
  position: number;
  defaultDuration: number;
  defaultTransition: HeroTransition;
  busy: boolean;
  onUpdate: (patch: HeroUpdateInput) => void;
  onDelete: () => void;
  onReplace: (prepared: PreparedHeroImage) => Promise<void>;
  dragHandlers: {
    draggable: boolean;
    onDragStart: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: () => void;
    onDragEnd: () => void;
  };
}) {
  const [replacing, setReplacing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [alt, setAlt] = useState(slide.altText);
  const [title, setTitle] = useState(slide.title);

  return (
    <li
      className="rounded-lg border border-border bg-background p-4"
      onDragOver={dragHandlers.onDragOver}
      onDrop={dragHandlers.onDrop}
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,320px)_1fr]">
        <div className="relative">
          <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
            <img
              src={fallbackSrc(slide)}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <span
            className="absolute left-2 top-2 rounded bg-foreground/85 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-background"
            aria-hidden
          >
            Slide {position}
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              draggable={dragHandlers.draggable}
              onDragStart={dragHandlers.onDragStart}
              onDragEnd={dragHandlers.onDragEnd}
              className="flex cursor-grab items-center gap-2 text-xs text-muted-foreground active:cursor-grabbing"
              title="Drag to reorder"
            >
              <GripVertical size={16} /> Drag to reorder
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={slide.isActive}
                disabled={busy}
                onCheckedChange={(v) => onUpdate({ id: slide.id, isActive: v })}
                aria-label="Slide active"
              />
              <span className={slide.isActive ? "" : "text-muted-foreground"}>
                {slide.isActive ? "Active" : "Inactive"}
              </span>
            </label>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
            <div>
              <dt className="uppercase tracking-[0.14em]">Size</dt>
              <dd className="text-foreground">
                {slide.width} × {slide.height}
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.14em]">Type</dt>
              <dd className="text-foreground">{slide.mimeType.replace("image/", "").toUpperCase()}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.14em]">Original</dt>
              <dd className="text-foreground">{formatBytes(slide.fileSize)}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.14em]">Variants</dt>
              <dd className="text-foreground">{slide.variants.length}</dd>
            </div>
          </dl>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs" htmlFor={`title-${slide.id}`}>
                Internal name
              </Label>
              <Input
                id={`title-${slide.id}`}
                value={title}
                maxLength={120}
                disabled={busy}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => title !== slide.title && onUpdate({ id: slide.id, title })}
                placeholder="e.g. Summer collection"
              />
            </div>
            <div>
              <Label className="text-xs" htmlFor={`alt-${slide.id}`}>
                Alt text (leave empty if decorative)
              </Label>
              <Input
                id={`alt-${slide.id}`}
                value={alt}
                maxLength={200}
                disabled={busy}
                onChange={(e) => setAlt(e.target.value)}
                onBlur={() => alt !== slide.altText && onUpdate({ id: slide.id, altText: alt })}
                placeholder="Describe the image for screen readers"
              />
            </div>
            <div>
              <Label className="text-xs" htmlFor={`dur-${slide.id}`}>
                Display duration (seconds)
              </Label>
              <Input
                id={`dur-${slide.id}`}
                type="number"
                min={MIN_DURATION}
                max={MAX_DURATION}
                step={1}
                disabled={busy}
                value={slide.duration ?? ""}
                placeholder={`Default (${defaultDuration})`}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return onUpdate({ id: slide.id, duration: null });
                  const n = Number(raw);
                  if (!Number.isFinite(n)) return;
                  onUpdate({
                    id: slide.id,
                    duration: Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(n))),
                  });
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Transition</Label>
              <Select
                value={slide.transition ?? "default"}
                disabled={busy}
                onValueChange={(v) =>
                  onUpdate({
                    id: slide.id,
                    transition: v === "default" ? null : (v as HeroTransition),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    Default ({TRANSITIONS.find((t) => t.value === defaultTransition)?.label})
                  </SelectItem>
                  {TRANSITIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setReplacing((v) => !v)}
            >
              {replacing ? "Cancel replace" : "Replace image"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={15} /> Delete
            </Button>
          </div>

          {replacing && (
            <HeroUpload
              busy={busy}
              compact
              label="Choose replacement"
              onPrepared={async (prepared) => {
                await onReplace(prepared);
                setReplacing(false);
              }}
            />
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Hero slide?</AlertDialogTitle>
            <AlertDialogDescription>
              This image will be removed from the Hero Slider and can no longer be displayed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete slide</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
