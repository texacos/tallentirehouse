import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { GripVertical, Loader2, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/site/ProductImage";
import {
  PRODUCT_IMAGE_SIZE,
  altFromFilename,
  managedImageId,
} from "@/lib/product-images";
import { prepareProductImage, ProductImageError } from "@/lib/product-image-prepare";
import {
  adminProductImageDelete,
  adminProductImageUpload,
} from "@/lib/product-images.functions";

type QueueItem = {
  key: string;
  file: File;
  status: "pending" | "working" | "error";
  progress: number;
  error?: string;
};

const CONCURRENCY = 3;

export function ImageUploader({
  images,
  alts,
  onChange,
  max = 30,
  withAlts = true,
  compact = false,
  label,
}: {
  images: string[];
  alts?: string[];
  onChange: (images: string[], alts: string[]) => void;
  max?: number;
  withAlts?: boolean;
  compact?: boolean;
  label?: string;
}) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const stateRef = useRef({ images, alts: alts ?? [] });
  stateRef.current = { images, alts: alts ?? [] };

  const patchQueue = (key: string, p: Partial<QueueItem>) =>
    setQueue((q) => q.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const uploadOne = useCallback(async (item: QueueItem) => {
    patchQueue(item.key, { status: "working", progress: 10, error: undefined });
    try {
      const prepared = await prepareProductImage(item.file);
      patchQueue(item.key, { progress: 55 });
      const { url } = await adminProductImageUpload({
        data: {
          filename: prepared.filename,
          fileSize: prepared.fileSize,
          master: prepared.master,
          derivatives: prepared.derivatives,
        },
      });
      const current = stateRef.current;
      const nextImages = [...current.images, url];
      const nextAlts = [...current.alts];
      while (nextAlts.length < nextImages.length - 1) nextAlts.push("");
      nextAlts.push(altFromFilename(item.file.name));
      stateRef.current = { images: nextImages, alts: nextAlts };
      onChange(nextImages, nextAlts);
      setQueue((q) => q.filter((i) => i.key !== item.key));
    } catch (e) {
      const msg =
        e instanceof ProductImageError || e instanceof Error
          ? e.message
          : "Upload failed. Please try again.";
      patchQueue(item.key, { status: "error", progress: 0, error: msg });
    }
  }, [onChange]);

  const runQueue = useCallback(
    async (items: QueueItem[]) => {
      setBusy(true);
      const pool = [...items];
      const workers = Array.from({ length: Math.min(CONCURRENCY, pool.length) }, async () => {
        for (;;) {
          const next = pool.shift();
          if (!next) return;
          await uploadOne(next);
        }
      });
      await Promise.all(workers);
      setBusy(false);
    },
    [uploadOne],
  );

  const addFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      const list = Array.from(files);
      const room = max - stateRef.current.images.length;
      if (room <= 0) {
        toast.error(`You can attach at most ${max} image${max === 1 ? "" : "s"}.`);
        return;
      }
      const accepted = list.slice(0, room);
      if (accepted.length < list.length) {
        toast.error(`Only ${room} more image${room === 1 ? "" : "s"} can be added.`);
      }
      const items: QueueItem[] = accepted.map((file) => ({
        key: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        status: "pending",
        progress: 0,
      }));
      setQueue((q) => [...q, ...items]);
      void runQueue(items);
    },
    [max, runQueue],
  );

  function move(from: number, to: number) {
    const nextImages = [...images];
    const nextAlts = [...(alts ?? [])];
    while (nextAlts.length < nextImages.length) nextAlts.push("");
    const [img] = nextImages.splice(from, 1);
    const [alt] = nextAlts.splice(from, 1);
    nextImages.splice(to, 0, img!);
    nextAlts.splice(to, 0, alt ?? "");
    onChange(nextImages, nextAlts);
  }

  async function remove(i: number) {
    const url = images[i]!;
    if (!window.confirm("Remove this image? It will also be deleted from storage.")) return;
    const nextImages = images.filter((_, idx) => idx !== i);
    const nextAlts = (alts ?? []).filter((_, idx) => idx !== i);
    onChange(nextImages, nextAlts);
    const id = managedImageId(url);
    if (id) {
      try {
        await adminProductImageDelete({ data: { id } });
      } catch {
        toast.error("Image removed from the product, but storage cleanup failed.");
      }
    }
  }

  function setAlt(i: number, value: string) {
    const next = [...(alts ?? [])];
    while (next.length < images.length) next.push("");
    next[i] = value;
    onChange(images, next);
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-md border border-dashed p-5 text-center transition-colors",
          dragOver ? "border-foreground bg-muted/50" : "border-border",
        )}
      >
        <p className="text-sm text-muted-foreground">
          {label ?? "Drag & drop images here, or"}
        </p>
        <label className="mt-3 inline-flex">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={max > 1}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-4 text-sm">
            {busy ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />}
            Choose file{max > 1 ? "s" : ""}
          </span>
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          JPEG, PNG or WebP · square, min {PRODUCT_IMAGE_SIZE} × {PRODUCT_IMAGE_SIZE} px · up to
          8 MB · {images.length}/{max} used
        </p>
      </div>

      {queue.length > 0 && (
        <ul className="space-y-2">
          {queue.map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
              {item.status === "error" ? (
                <>
                  <span className="max-w-[50%] truncate text-xs text-destructive" role="alert">
                    {item.error}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void runQueue([{ ...item, status: "pending" }])}
                  >
                    <RotateCcw size={14} /> Retry
                  </Button>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setQueue((q) => q.filter((i) => i.key !== item.key))}
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="animate-spin" size={13} />
                  {item.progress < 55 ? "Optimising…" : "Uploading…"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className={cn("grid gap-3", compact ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {images.map((src, i) => (
          <div
            key={`${src}-${i}`}
            draggable
            onDragStart={() => (dragIndex.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex.current != null && dragIndex.current !== i) move(dragIndex.current, i);
              dragIndex.current = null;
            }}
            className="space-y-2 rounded-md border border-border p-2"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <GripVertical size={12} /> {i === 0 && max > 1 ? "Cover" : `Image ${i + 1}`}
              </span>
              <button
                type="button"
                aria-label={`Remove image ${i + 1}`}
                onClick={() => void remove(i)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="aspect-square overflow-hidden rounded bg-muted">
              <ProductImage
                src={src}
                alt={(alts ?? [])[i] ?? ""}
                sizes="200px"
                width={200}
                height={200}
                className="size-full object-cover"
              />
            </div>
            {withAlts && (
              <Input
                value={(alts ?? [])[i] ?? ""}
                placeholder="Alt text"
                aria-label={`Alt text for image ${i + 1}`}
                onChange={(e) => setAlt(i, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
