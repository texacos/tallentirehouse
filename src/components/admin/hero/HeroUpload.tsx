import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HERO_HEIGHT, HERO_WIDTH } from "@/lib/hero";
import { HeroImageError, prepareHeroImage, type PreparedHeroImage } from "@/lib/hero-image";

export function HeroUpload({
  busy,
  label = "Add hero image",
  compact = false,
  onPrepared,
}: {
  busy: boolean;
  label?: string;
  compact?: boolean;
  onPrepared: (prepared: PreparedHeroImage) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setInfo(null);
    setChecking(true);
    try {
      const prepared = await prepareHeroImage(file);
      setInfo(`Image dimensions: ${prepared.width} × ${prepared.height} ✓ — optimising…`);
      await onPrepared(prepared);
      setInfo(null);
    } catch (err) {
      setError(
        err instanceof HeroImageError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Upload failed. Please try again.",
      );
    } finally {
      setChecking(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const disabled = busy || checking;

  return (
    <div className={compact ? "" : "space-y-3"}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 text-center transition-colors ${
          compact ? "py-4" : "py-10"
        } ${dragging ? "border-foreground bg-secondary/60" : "border-border bg-secondary/20"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? undefined)}
        />
        <p className="text-sm text-muted-foreground">
          Drag an image here, or
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {disabled ? (
            <Loader2 className="animate-spin" size={15} />
          ) : (
            <Upload size={15} />
          )}
          {label}
        </Button>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG or WebP — exactly {HERO_WIDTH} × {HERO_HEIGHT} px, max 8 MB
        </p>
      </div>
      {info && <p className="text-xs text-foreground/70">{info}</p>}
      {error && (
        <p className="whitespace-pre-line rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
