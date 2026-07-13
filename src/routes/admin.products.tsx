import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, X, Upload, Loader2 } from "lucide-react";
import { z } from "zod";
import {
  CATEGORIES,
  formatPrice,
  slugify,
  SIZE_OPTIONS,
  isVariable,
  type Product,
  type ProductVariant,
} from "@/lib/products";
import { productsQueryOptions, useProducts } from "@/lib/products-store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const variantSchema = z.object({
  size: z.string().trim().min(1).max(40),
  sku: z.string().trim().max(40).optional().or(z.literal("")),
  price: z.coerce.number().int().min(0),
  stock: z.coerce.number().int().min(0),
});

const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  sku: z.string().trim().max(40).optional().or(z.literal("")),
  price: z.coerce.number().int().min(0, "Price must be 0 or more"),
  stock: z.coerce.number().int().min(0, "Stock must be 0 or more"),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  categories: z.array(z.string().min(1)).min(1, "Pick at least one category"),
  images: z.array(z.string().trim().min(1)).min(1, "Add at least one image"),
  variants: z.array(variantSchema),
});

export const Route = createFileRoute("/admin/products")({
  head: () => ({
    meta: [
      { title: "Manage products — Tallentire House" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQueryOptions),
  component: AdminProductsPage,
});

function AdminProductsPage() {
  const products = useProducts();
  const queryClient = useQueryClient();
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const filtered = useMemo(() => {
    if (!query.trim()) return products.slice(0, 60);
    const q = query.trim().toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [products, query]);

  const onDelete = async (slug: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("products").delete().eq("slug", slug);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Product deleted");
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-20 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <p className="eyebrow text-foreground/60">Access denied</p>
        <h1 className="mt-3 font-display text-3xl">Admin role required</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account doesn't have admin privileges. Ask an existing admin to grant you access.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/"><Button variant="outline">Back to shop</Button></Link>
          <Button variant="ghost" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>Sign out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 lg:px-10 py-14">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="eyebrow text-foreground/60">Admin</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl">Products</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg">
            All {products.length} pieces live in a single database. Add, edit or remove
            them here — changes appear across the shop immediately.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? "outline" : "default"}>
          {showForm ? <X /> : <Plus />}
          {showForm ? "Cancel" : "New product"}
        </Button>
      </div>

      {showForm && (
        <div className="mt-10 border border-border p-6 lg:p-8 bg-card">
          <NewProductForm
            onCreated={(slug) => {
              setShowForm(false);
              queryClient.invalidateQueries({ queryKey: ["products"] });
              navigate({ to: "/product/$slug", params: { slug } });
            }}
          />
        </div>
      )}

      <div className="mt-12 rule" />

      <div className="mt-10 flex items-center justify-between gap-4 flex-wrap">
        <h2 className="font-display text-2xl">
          All products
          <span className="ml-2 text-foreground/40 tabular-nums text-base">{products.length}</span>
        </h2>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, slug or SKU…"
          className="max-w-xs"
        />
      </div>

      <ul className="mt-6 divide-y divide-border border-y border-border">
        {filtered.map((p) => (
          <li key={p.slug} className="flex items-center gap-4 py-4">
            <div className="h-16 w-16 shrink-0 bg-muted overflow-hidden">
              {p.images[0] && (
                <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Link
                to="/product/$slug"
                params={{ slug: p.slug }}
                className="font-medium hover:underline underline-offset-4"
              >
                {p.name}
              </Link>
              <p className="text-xs text-muted-foreground truncate">
                {p.sku ? `${p.sku} · ` : ""}
                {p.categories.join(", ")}
                {isVariable(p) && (
                  <span className="ml-2 uppercase tracking-[0.16em] text-[10px] text-foreground/60">
                    · {p.variants.length} sizes
                  </span>
                )}
              </p>
            </div>
            <div className="text-sm tabular-nums">{formatPrice(p.price)}</div>
            <button
              aria-label={`Delete ${p.name}`}
              onClick={() => onDelete(p.slug, p.name)}
              className="p-2 text-foreground/60 hover:text-destructive transition"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
      {query.trim() === "" && products.length > filtered.length && (
        <p className="mt-4 text-xs text-muted-foreground">
          Showing first {filtered.length} of {products.length}. Use the search to find more.
        </p>
      )}
    </div>
  );
}

function NewProductForm({ onCreated }: { onCreated: (slug: string) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<Array<{ size: string; sku: string; price: string }>>([]);

  const sortedCategories = useMemo(
    () => [...CATEGORIES].sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function toggleCat(c: string) {
    setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function toggleSize(size: string) {
    setVariants((prev) => {
      const idx = prev.findIndex((v) => v.size === size);
      if (idx >= 0) return prev.filter((v) => v.size !== size);
      return [...prev, { size, sku: "", price: price || "" }];
    });
  }

  function updateVariant(size: string, patch: Partial<{ sku: string; price: string }>) {
    setVariants((prev) => prev.map((v) => (v.size === size ? { ...v, ...patch } : v)));
  }

  async function onFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of Array.from(fileList)) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const key = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("product-images")
          .upload(key, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
        if (error) {
          toast.error(`Upload failed: ${error.message}`);
          continue;
        }
        uploaded.push(`/api/public/product-images/${key}`);
      }
      if (uploaded.length) {
        setImages((prev) => [...prev, ...uploaded]);
        toast.success(`Uploaded ${uploaded.length} image${uploaded.length > 1 ? "s" : ""}`);
      }
    } finally {
      setUploading(false);
    }
  }

  function removeImage(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const variantPayload = hasVariants ? variants : [];
    const result = productSchema.safeParse({
      name,
      slug,
      sku,
      price,
      description,
      categories: cats,
      images,
      variants: variantPayload,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString() ?? "form";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    if (hasVariants && result.data.variants.length === 0) {
      setErrors({ variants: "Add at least one size, or turn off variable pricing." });
      return;
    }
    setErrors({});
    setSubmitting(true);

    const cleanVariants: ProductVariant[] = result.data.variants.map((v) => ({
      size: v.size,
      sku: v.sku || undefined,
      price: v.price,
    }));

    const row: Omit<Product, never> = {
      slug: result.data.slug,
      name: result.data.name,
      sku: result.data.sku ?? "",
      price: result.data.price,
      description: result.data.description ?? "",
      categories: result.data.categories,
      images: result.data.images,
      variants: cleanVariants,
    };

    const { error } = await supabase.from("products").insert(row);
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") {
        setErrors({ slug: `A product with the slug "${row.slug}" already exists.` });
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Product created");
    onCreated(row.slug);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Field label="Name" error={errors.name}>
          <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Feather Cushion – Juniper" maxLength={160} />
        </Field>
        <Field label="Slug" error={errors.slug} hint="Used in the product URL">
          <Input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            placeholder="feather-cushion-juniper"
            maxLength={120}
          />
        </Field>
        <Field label="SKU (optional)" error={errors.sku}>
          <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="CF01" maxLength={40} />
        </Field>
        <Field label={hasVariants ? "Base price (LKR)" : "Price (LKR)"} error={errors.price} hint={hasVariants ? "Fallback when no size chosen" : undefined}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="10500"
          />
        </Field>
      </div>

      <Field label="Description" error={errors.description}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          maxLength={4000}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Tell the story of this piece…"
        />
      </Field>

      <Field label="Categories" error={errors.categories} hint={`${cats.length} selected`}>
        <div className="max-h-56 overflow-y-auto border border-border rounded-md p-3 grid grid-cols-2 md:grid-cols-3 gap-1.5">
          {sortedCategories.map((c) => {
            const checked = cats.includes(c.slug);
            return (
              <label
                key={c.slug}
                className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded cursor-pointer ${
                  checked ? "bg-accent text-accent-foreground" : "hover:bg-accent/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCat(c.slug)}
                  className="accent-foreground"
                />
                <span className="truncate">{c.label}</span>
              </label>
            );
          })}
        </div>
      </Field>

      <div className="border border-border rounded-md p-4 space-y-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={hasVariants}
            onChange={(e) => setHasVariants(e.target.checked)}
            className="accent-foreground"
          />
          <span className="font-medium">Variable product — offer sizes</span>
        </label>
        {hasVariants && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Select the sizes this piece is offered in, then set a price for each. The
              base price above is used as a fallback for the shop card "from" price.
            </p>
            <div className="flex flex-wrap gap-2">
              {SIZE_OPTIONS.map((s) => {
                const active = variants.some((v) => v.size === s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleSize(s.value)}
                    className={`px-3 py-1.5 text-xs border transition ${
                      active
                        ? "bg-foreground text-background border-foreground"
                        : "border-border hover:border-foreground"
                    }`}
                  >
                    {s.value} — {s.label}
                  </button>
                );
              })}
            </div>
            {variants.length > 0 && (
              <div className="grid gap-2">
                {variants.map((v) => (
                  <div key={v.size} className="grid grid-cols-[auto_1fr_1fr] gap-3 items-center">
                    <div className="w-10 text-center text-sm font-medium">{v.size}</div>
                    <Input
                      placeholder="SKU (optional)"
                      value={v.sku}
                      onChange={(e) => updateVariant(v.size, { sku: e.target.value })}
                      maxLength={40}
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      placeholder="Price (LKR)"
                      value={v.price}
                      onChange={(e) => updateVariant(v.size, { price: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}
            {errors.variants && <p className="text-xs text-destructive">{errors.variants}</p>}
          </div>
        )}
      </div>

      <Field
        label="Images"
        error={errors.images}
        hint="Upload JPG or PNG files — they'll be stored securely."
      >
        <div className="space-y-3">
          {images.length > 0 && (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {images.map((src, i) => (
                <div key={src + i} className="relative aspect-square bg-muted overflow-hidden group">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 bg-background/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                    aria-label="Remove image"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="inline-flex items-center gap-2 border border-dashed border-border rounded-md px-4 py-3 cursor-pointer hover:bg-accent/30 transition text-sm">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            <span>{uploading ? "Uploading…" : "Add images"}</span>
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => onFilesSelected(e.target.files)}
              disabled={uploading}
            />
          </label>
        </div>
      </Field>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={submitting || uploading}>
          {submitting ? <><Loader2 className="animate-spin" /> Creating…</> : "Create product"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label className="text-xs uppercase tracking-[0.18em] text-foreground/70">{label}</Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
