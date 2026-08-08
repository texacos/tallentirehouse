import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  GripVertical,
  Copy,
  RotateCcw,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, formatPrice, slugify } from "@/lib/products";
import {
  PRODUCT_STATUSES,
  STATUS_LABEL,
  adminProductSchema,
  adminVariantSchema,
  emptyProduct,
  margin,
  type AdminProduct,
  type AdminProductValues,
  type AdminVariant,
} from "@/lib/admin-products.types";
import { useRevisions, useSaveProduct } from "@/lib/admin-products-client";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"];

function toValues(p: AdminProduct | null): AdminProductValues {
  if (!p) return emptyProduct();
  const { id: _id, total_stock: _ts, created_at: _c, updated_at: _u, ...rest } = p;
  return adminProductSchema.parse(rest);
}

function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ProductEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: AdminProduct | null;
  onClose: () => void;
  onSaved: (values: AdminProductValues) => void;
}) {
  const [values, setValues] = useState<AdminProductValues>(() => toValues(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [autosave, setAutosave] = useState(!!initial);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const dragIndex = useRef<number | null>(null);
  const save = useSaveProduct();
  const revisions = useRevisions(initial?.id ?? null);

  const patch = useCallback((p: Partial<AdminProductValues>) => {
    setValues((v) => ({ ...v, ...p }));
    setDirty(true);
  }, []);

  const commit = useCallback(
    async (silent = false) => {
      const parsed = adminProductSchema.safeParse(values);
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? "form");
          if (!next[key]) next[key] = issue.message;
        }
        setErrors(next);
        if (!silent) toast.error("Please fix the highlighted fields");
        return false;
      }
      setErrors({});
      try {
        await save.mutateAsync(parsed.data);
        setDirty(false);
        setLastSaved(new Date().toLocaleTimeString());
        onSaved(parsed.data);
        if (!silent) toast.success("Product saved");
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save the product");
        return false;
      }
    },
    [values, save, onSaved],
  );

  // Autosave (existing products only)
  useEffect(() => {
    if (!autosave || !dirty || !initial) return;
    const t = setTimeout(() => void commit(true), 1500);
    return () => clearTimeout(t);
  }, [autosave, dirty, initial, commit]);

  // Dirty-state guard
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const attemptClose = () => {
    if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    onClose();
  };

  const sortedCategories = useMemo(
    () => [...CATEGORIES].sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const added: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!ALLOWED_MIME.includes(file.type)) {
          toast.error(`${file.name}: only JPEG, PNG, WebP or AVIF are allowed`);
          continue;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          toast.error(`${file.name} is larger than 8 MB`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const key = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("product-images")
          .upload(key, file, {
            cacheControl: "31536000",
            upsert: false,
            contentType: file.type,
          });
        if (error) {
          toast.error(`Upload failed: ${error.message}`);
          continue;
        }
        added.push(`/api/public/product-images/${key}`);
      }
      if (added.length) {
        patch({
          images: [...(values.images ?? []), ...added],
          image_alts: [...(values.image_alts ?? []), ...added.map(() => "")],
        });
        toast.success(`Uploaded ${added.length} image${added.length === 1 ? "" : "s"}`);
      }
    } finally {
      setUploading(false);
    }
  }

  function moveImage(from: number, to: number) {
    const images = [...(values.images ?? [])];
    const alts = [...(values.image_alts ?? [])];
    const [img] = images.splice(from, 1);
    const [alt] = alts.splice(from, 1);
    images.splice(to, 0, img);
    alts.splice(to, 0, alt ?? "");
    patch({ images, image_alts: alts });
  }

  function removeImage(i: number) {
    patch({
      images: (values.images ?? []).filter((_, idx) => idx !== i),
      image_alts: (values.image_alts ?? []).filter((_, idx) => idx !== i),
    });
  }

  const variants = (values.variants ?? []) as AdminVariant[];
  const setVariants = (next: AdminVariant[]) => patch({ variants: next });
  const updateVariant = (i: number, p: Partial<AdminVariant>) =>
    setVariants(variants.map((v, idx) => (idx === i ? { ...v, ...p } : v)));

  const m = margin({
    price: Number(values.price) || 0,
    sale_price: values.sale_price == null ? null : Number(values.sale_price),
    cost_price: values.cost_price == null ? null : Number(values.cost_price),
  });

  return (
    <section className="rounded-md border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-display text-2xl">
            {initial ? `Edit — ${initial.name}` : "New product"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {dirty ? "Unsaved changes" : lastSaved ? `Saved at ${lastSaved}` : "Up to date"}
            {save.isPending && " · saving…"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {initial && (
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Switch checked={autosave} onCheckedChange={setAutosave} />
              Autosave
            </label>
          )}
          <Button onClick={() => void commit()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save
          </Button>
          <Button variant="ghost" size="icon" aria-label="Close editor" onClick={attemptClose}>
            <X />
          </Button>
        </div>
      </header>

      <Tabs defaultValue="general" className="px-5 py-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="shipping">Shipping</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          {initial && <TabsTrigger value="history">History</TabsTrigger>}
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general" className="grid gap-5 pt-4 md:grid-cols-2">
          <Field label="Name" error={errors.name} htmlFor="p-name">
            <Input
              id="p-name"
              value={values.name}
              maxLength={160}
              onChange={(e) => {
                const name = e.target.value;
                patch(slugTouched ? { name } : { name, slug: slugify(name) || "new-product" });
              }}
            />
          </Field>
          <Field label="Slug" error={errors.slug} hint="Used in the product URL" htmlFor="p-slug">
            <Input
              id="p-slug"
              value={values.slug}
              maxLength={120}
              onChange={(e) => {
                setSlugTouched(true);
                patch({ slug: e.target.value });
              }}
            />
          </Field>
          <Field label="Status" htmlFor="p-status">
            <select
              id="p-status"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={values.status}
              onChange={(e) =>
                patch({ status: e.target.value as AdminProductValues["status"] })
              }
            >
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Publish date"
            hint="Used when the status is Scheduled"
            htmlFor="p-published"
          >
            <Input
              id="p-published"
              type="datetime-local"
              value={values.published_at ? String(values.published_at).slice(0, 16) : ""}
              onChange={(e) =>
                patch({
                  published_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
          </Field>
          <Field label="Brand" htmlFor="p-brand">
            <Input
              id="p-brand"
              value={values.brand ?? ""}
              maxLength={80}
              onChange={(e) => patch({ brand: e.target.value })}
            />
          </Field>
          <Field label="Collection" htmlFor="p-collection">
            <Input
              id="p-collection"
              value={values.collection ?? ""}
              maxLength={80}
              onChange={(e) => patch({ collection: e.target.value })}
            />
          </Field>
          <Field label="Supplier" htmlFor="p-supplier">
            <Input
              id="p-supplier"
              value={values.supplier ?? ""}
              maxLength={80}
              onChange={(e) => patch({ supplier: e.target.value })}
            />
          </Field>
          <Field label="Tags" hint="Comma separated" htmlFor="p-tags">
            <Input
              id="p-tags"
              value={(values.tags ?? []).join(", ")}
              onChange={(e) =>
                patch({
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .slice(0, 50),
                })
              }
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description" error={errors.description} htmlFor="p-desc">
              <Textarea
                id="p-desc"
                rows={6}
                maxLength={8000}
                value={values.description ?? ""}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field
              label="Categories"
              error={errors.categories}
              hint={`${values.categories.length} selected`}
            >
              <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border border-border p-3 md:grid-cols-3">
                {sortedCategories.map((c) => {
                  const checked = values.categories.includes(c.slug);
                  return (
                    <label
                      key={c.slug}
                      className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs ${
                        checked ? "bg-accent text-accent-foreground" : "hover:bg-accent/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-foreground"
                        checked={checked}
                        onChange={() =>
                          patch({
                            categories: checked
                              ? values.categories.filter((x) => x !== c.slug)
                              : [...values.categories, c.slug],
                          })
                        }
                      />
                      <span className="truncate">{c.label}</span>
                    </label>
                  );
                })}
              </div>
            </Field>
          </div>
        </TabsContent>

        {/* INVENTORY */}
        <TabsContent value="inventory" className="grid gap-5 pt-4 md:grid-cols-2">
          <Field label="SKU" htmlFor="p-sku">
            <Input
              id="p-sku"
              value={values.sku ?? ""}
              maxLength={60}
              onChange={(e) => patch({ sku: e.target.value })}
            />
          </Field>
          <Field label="Barcode (GTIN/EAN)" htmlFor="p-barcode">
            <div className="flex gap-2">
              <Input
                id="p-barcode"
                value={values.barcode ?? ""}
                maxLength={60}
                onChange={(e) => patch({ barcode: e.target.value })}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  patch({
                    barcode: `THB${Math.floor(Math.random() * 1_000_000_000)
                      .toString()
                      .padStart(9, "0")}`,
                  })
                }
              >
                Generate
              </Button>
            </div>
          </Field>
          <Field
            label="Stock"
            hint={variants.length ? "Managed per variant" : "Units on hand"}
            htmlFor="p-stock"
          >
            <Input
              id="p-stock"
              type="number"
              min={0}
              step={1}
              disabled={variants.length > 0}
              value={values.stock}
              onChange={(e) => patch({ stock: Number(e.target.value) })}
            />
          </Field>
          <Field label="Reorder level" hint="Low-stock warnings below this" htmlFor="p-reorder">
            <Input
              id="p-reorder"
              type="number"
              min={0}
              step={1}
              value={values.reorder_level ?? 0}
              onChange={(e) => patch({ reorder_level: Number(e.target.value) })}
            />
          </Field>
          <Field label="Storage location" htmlFor="p-location">
            <Input
              id="p-location"
              value={values.location ?? ""}
              maxLength={80}
              onChange={(e) => patch({ location: e.target.value })}
            />
          </Field>
          <div className="flex items-center gap-6 pt-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch
                checked={values.track_inventory !== false}
                onCheckedChange={(v) => patch({ track_inventory: v })}
              />
              Track inventory
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch
                checked={values.backorders === true}
                onCheckedChange={(v) => patch({ backorders: v })}
              />
              Allow backorders
            </label>
          </div>
        </TabsContent>

        {/* PRICING */}
        <TabsContent value="pricing" className="grid gap-5 pt-4 md:grid-cols-3">
          <Field label="Regular price (USD)" error={errors.price} htmlFor="p-price">
            <Input
              id="p-price"
              type="number"
              min={0}
              step={0.5}
              value={values.price}
              onChange={(e) => patch({ price: Number(e.target.value) })}
            />
          </Field>
          <Field label="Sale price (USD)" htmlFor="p-sale">
            <Input
              id="p-sale"
              type="number"
              min={0}
              step={0.5}
              value={values.sale_price ?? ""}
              onChange={(e) =>
                patch({ sale_price: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Cost price (USD)" htmlFor="p-cost">
            <Input
              id="p-cost"
              type="number"
              min={0}
              step={0.5}
              value={values.cost_price ?? ""}
              onChange={(e) =>
                patch({ cost_price: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </Field>
          <div className="md:col-span-3 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
            {m ? (
              <>
                Profit <strong>{formatPrice(Math.round(m.profit * 100) / 100)}</strong> · Margin{" "}
                <strong>{m.marginPct.toFixed(1)}%</strong> · Markup{" "}
                <strong>{m.markupPct.toFixed(1)}%</strong>
              </>
            ) : (
              <span className="text-muted-foreground">
                Add a cost price to see margin and markup.
              </span>
            )}
          </div>
        </TabsContent>

        {/* SHIPPING */}
        <TabsContent value="shipping" className="grid gap-5 pt-4 md:grid-cols-2">
          <Field
            label="Weight (kg)"
            hint="Used by the shipping calculator at checkout"
            htmlFor="p-weight"
          >
            <Input
              id="p-weight"
              type="number"
              min={0}
              step={0.01}
              value={values.weight_kg}
              onChange={(e) => patch({ weight_kg: Number(e.target.value) })}
            />
          </Field>
        </TabsContent>

        {/* IMAGES */}
        <TabsContent value="images" className="space-y-4 pt-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void uploadFiles(e.dataTransfer.files);
            }}
            className="rounded-md border border-dashed border-border p-6 text-center"
          >
            <p className="text-sm text-muted-foreground">
              Drag &amp; drop images here, or
            </p>
            <label className="mt-3 inline-flex">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                className="hidden"
                onChange={(e) => void uploadFiles(e.target.files)}
              />
              <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-4 text-sm">
                {uploading ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />}
                Choose files
              </span>
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              JPEG, PNG, WebP or AVIF · up to 8 MB each
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(values.images ?? []).map((src, i) => (
              <div
                key={`${src}-${i}`}
                draggable
                onDragStart={() => (dragIndex.current = i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex.current != null && dragIndex.current !== i) {
                    moveImage(dragIndex.current, i);
                  }
                  dragIndex.current = null;
                }}
                className="space-y-2 rounded-md border border-border p-2"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <GripVertical size={12} /> {i === 0 ? "Cover" : `Image ${i + 1}`}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove image ${i + 1}`}
                    onClick={() => removeImage(i)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="aspect-square overflow-hidden rounded bg-muted">
                  <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                </div>
                <Input
                  value={(values.image_alts ?? [])[i] ?? ""}
                  placeholder="Alt text"
                  aria-label={`Alt text for image ${i + 1}`}
                  onChange={(e) => {
                    const alts = [...(values.image_alts ?? [])];
                    while (alts.length < (values.images ?? []).length) alts.push("");
                    alts[i] = e.target.value;
                    patch({ image_alts: alts });
                  }}
                />
              </div>
            ))}
          </div>
        </TabsContent>

        {/* VARIANTS */}
        <TabsContent value="variants" className="space-y-4 pt-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setVariants([
                  ...variants,
                  adminVariantSchema.parse({
                    size: `Variant ${variants.length + 1}`,
                    price: Number(values.price) || 0,
                    stock: 0,
                  }),
                ])
              }
            >
              <Plus /> Add variant
            </Button>
            {variants.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {variants.length} variants · {variants.reduce((n, v) => n + v.stock, 0)} units
              </span>
            )}
          </div>

          {variants.map((v, i) => (
            <div key={i} className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-4">
              <Field label="Size / label" htmlFor={`v-size-${i}`}>
                <Input
                  id={`v-size-${i}`}
                  value={v.size}
                  onChange={(e) => updateVariant(i, { size: e.target.value })}
                />
              </Field>
              <Field label="Colour" htmlFor={`v-colour-${i}`}>
                <Input
                  id={`v-colour-${i}`}
                  value={v.colour}
                  onChange={(e) => updateVariant(i, { colour: e.target.value })}
                />
              </Field>
              <Field label="Material" htmlFor={`v-material-${i}`}>
                <Input
                  id={`v-material-${i}`}
                  value={v.material}
                  onChange={(e) => updateVariant(i, { material: e.target.value })}
                />
              </Field>
              <Field label="SKU" htmlFor={`v-sku-${i}`}>
                <Input
                  id={`v-sku-${i}`}
                  value={v.sku}
                  onChange={(e) => updateVariant(i, { sku: e.target.value })}
                />
              </Field>
              <Field label="Barcode" htmlFor={`v-barcode-${i}`}>
                <Input
                  id={`v-barcode-${i}`}
                  value={v.barcode}
                  onChange={(e) => updateVariant(i, { barcode: e.target.value })}
                />
              </Field>
              <Field label="Price (USD)" htmlFor={`v-price-${i}`}>
                <Input
                  id={`v-price-${i}`}
                  type="number"
                  min={0}
                  step={0.5}
                  value={v.price}
                  onChange={(e) => updateVariant(i, { price: Number(e.target.value) })}
                />
              </Field>
              <Field label="Stock" htmlFor={`v-stock-${i}`}>
                <Input
                  id={`v-stock-${i}`}
                  type="number"
                  min={0}
                  step={1}
                  value={v.stock}
                  onChange={(e) => updateVariant(i, { stock: Number(e.target.value) })}
                />
              </Field>
              <Field label="Weight (kg)" htmlFor={`v-weight-${i}`}>
                <Input
                  id={`v-weight-${i}`}
                  type="number"
                  min={0}
                  step={0.01}
                  value={v.weight_kg}
                  onChange={(e) => updateVariant(i, { weight_kg: Number(e.target.value) })}
                />
              </Field>
              <Field label="Volume" htmlFor={`v-volume-${i}`}>
                <Input
                  id={`v-volume-${i}`}
                  value={v.volume}
                  onChange={(e) => updateVariant(i, { volume: e.target.value })}
                />
              </Field>
              <Field label="Length" htmlFor={`v-length-${i}`}>
                <Input
                  id={`v-length-${i}`}
                  value={v.length}
                  onChange={(e) => updateVariant(i, { length: e.target.value })}
                />
              </Field>
              <Field label="Image URL" htmlFor={`v-image-${i}`}>
                <Input
                  id={`v-image-${i}`}
                  value={v.image}
                  placeholder="/api/public/product-images/…"
                  onChange={(e) => updateVariant(i, { image: e.target.value })}
                />
              </Field>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setVariants([
                      ...variants.slice(0, i + 1),
                      { ...v, size: `${v.size} copy`, sku: "", barcode: "" },
                      ...variants.slice(i + 1),
                    ])
                  }
                >
                  <Copy /> Clone
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setVariants(variants.filter((_, idx) => idx !== i))}
                >
                  <Trash2 /> Remove
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* SEO */}
        <TabsContent value="seo" className="grid gap-5 pt-4">
          <Field
            label="SEO title"
            hint={`${(values.seo_title ?? "").length}/60 recommended`}
            htmlFor="p-seotitle"
          >
            <Input
              id="p-seotitle"
              maxLength={160}
              value={values.seo_title ?? ""}
              onChange={(e) => patch({ seo_title: e.target.value })}
            />
          </Field>
          <Field
            label="Meta description"
            hint={`${(values.seo_description ?? "").length}/160 recommended`}
            htmlFor="p-seodesc"
          >
            <Textarea
              id="p-seodesc"
              rows={3}
              maxLength={320}
              value={values.seo_description ?? ""}
              onChange={(e) => patch({ seo_description: e.target.value })}
            />
          </Field>
        </TabsContent>

        {/* HISTORY */}
        {initial && (
          <TabsContent value="history" className="space-y-3 pt-4">
            {revisions.isLoading && (
              <p className="text-sm text-muted-foreground">Loading history…</p>
            )}
            {revisions.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
            )}
            {(revisions.data ?? []).map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <strong>{r.action}</strong> by {r.actor_label} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Changed: {r.changed_fields.join(", ") || "—"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    try {
                      const snap = JSON.parse(r.snapshotJson) as Record<string, unknown>;
                      if (!snap || !Object.keys(snap).length) {
                        toast.error("This revision has no snapshot to restore");
                        return;
                      }
                      const parsed = adminProductSchema.safeParse({
                        ...snap,
                        id: undefined,
                        slug: values.slug,
                      });
                      if (!parsed.success) {
                        toast.error("This revision cannot be restored");
                        return;
                      }
                      setValues(parsed.data);
                      setDirty(true);
                      toast.success("Revision loaded — review and save");
                    } catch {
                      toast.error("This revision cannot be restored");
                    }
                  }}
                >
                  <RotateCcw /> Roll back
                </Button>
              </div>
            ))}
          </TabsContent>
        )}
      </Tabs>
    </section>
  );
}
