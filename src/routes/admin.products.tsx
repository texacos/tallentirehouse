import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  Plus,
  X,
  Upload,
  Loader2,
  Pencil,
  Search,
  Download,
} from "lucide-react";
import Papa from "papaparse";
import { z } from "zod";
import {
  CATEGORIES,
  formatPrice,
  slugify,
  SIZE_OPTIONS,
  isVariable,
  totalStock,
  type Product,
  type ProductVariant,
} from "@/lib/products";
import { productsQueryOptions, useProducts } from "@/lib/products-store";
import { useSiteSettings, useUpdateSiteSetting } from "@/lib/site-settings";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const variantSchema = z.object({
  size: z.string().trim().min(1).max(40),
  sku: z.string().trim().max(40).optional().or(z.literal("")),
  price: z.coerce.number().min(0),
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
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  weight_kg: z.coerce.number().min(0, "Weight must be 0 or more"),
  stock: z.coerce.number().int().min(0, "Stock must be 0 or more"),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  categories: z.array(z.string().min(1)).min(1, "Pick at least one category"),
  images: z.array(z.string().trim().min(1)).min(1, "Add at least one image"),
  variants: z.array(variantSchema),
});

// ---------- CSV helpers (moved from the removed import/export page) ----------

const CSV_COLUMNS = [
  "slug",
  "name",
  "sku",
  "price",
  "weight_kg",
  "stock",
  "description",
  "categories",
  "images",
  "variants",
] as const;

type CsvRow = Record<(typeof CSV_COLUMNS)[number], string>;

function productToCsvRow(p: Product): CsvRow {
  return {
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    price: String(p.price),
    weight_kg: String(p.weight_kg ?? 0),
    stock: String(p.stock ?? 0),
    description: p.description,
    categories: p.categories.join("|"),
    images: p.images.join("|"),
    variants: p.variants.length ? JSON.stringify(p.variants) : "",
  };
}

function parseVariants(raw: string): ProductVariant[] {
  const trimmed = raw?.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v) => v && typeof v.size === "string")
      .map((v) => ({
        size: String(v.size).slice(0, 40),
        sku: v.sku ? String(v.sku).slice(0, 40) : undefined,
        price: Number.isFinite(Number(v.price)) ? Math.max(0, Math.trunc(Number(v.price))) : 0,
        stock: Number.isFinite(Number(v.stock)) ? Math.max(0, Math.trunc(Number(v.stock))) : 0,
      }));
  } catch {
    return [];
  }
}

function csvRowToProduct(
  row: Partial<Record<string, string>>,
):
  | { ok: true; product: Omit<Product, never> }
  | { ok: false; error: string } {
  const slug = (row.slug ?? "").trim().toLowerCase();
  const name = (row.name ?? "").trim();
  if (!slug) return { ok: false, error: "Missing slug" };
  if (!/^[a-z0-9-]+$/.test(slug)) return { ok: false, error: `Invalid slug "${slug}"` };
  if (!name) return { ok: false, error: `Missing name for ${slug}` };
  const price = Number(row.price ?? "0");
  const stock = Number(row.stock ?? "0");
  const categories = (row.categories ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const images = (row.images ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const variants = parseVariants(row.variants ?? "");
  return {
    ok: true,
    product: {
      slug,
      name,
      sku: (row.sku ?? "").trim(),
      price: Number.isFinite(price) ? Math.max(0, Math.trunc(price)) : 0,
      stock: Number.isFinite(stock) ? Math.max(0, Math.trunc(stock)) : 0,
      description: (row.description ?? "").trim(),
      categories,
      images,
      variants,
    },
  };
}

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
  const { hideOutOfStock } = useSiteSettings();
  const updateSetting = useUpdateSiteSetting();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [busy, setBusy] = useState<null | "import" | "export">(null);
  const [lastReport, setLastReport] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const sortedCategories = useMemo(
    () => [...CATEGORIES].sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category && !p.categories.includes(category)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    });
  }, [products, query, category]);

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

  function onExport() {
    if (busy) return;
    const rows = filtered.map(productToCsvRow);
    if (rows.length === 0) {
      toast.error("No products match the current filter");
      return;
    }
    setBusy("export");
    try {
      const csv = Papa.unparse({ fields: [...CSV_COLUMNS], data: rows });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `products-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const msg = `Exported ${rows.length} product${rows.length === 1 ? "" : "s"}`;
      setLastReport(msg);
      toast.success(msg);
    } finally {
      setBusy(null);
    }
  }

  async function onImportFile(file: File) {
    setBusy("import");
    setLastReport(null);
    try {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
      });
      if (parsed.errors.length) toast.error(`CSV parse error: ${parsed.errors[0].message}`);
      const rows = parsed.data;
      if (!rows.length) {
        toast.error("CSV appears to be empty");
        return;
      }

      const existingSlugs = new Set(products.map((p) => p.slug));
      const toInsert: Array<Omit<Product, never>> = [];
      const toUpdate: Array<Omit<Product, never>> = [];
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const result = csvRowToProduct(rows[i]);
        if (!result.ok) {
          errors.push(`Row ${i + 2}: ${result.error}`);
          continue;
        }
        if (existingSlugs.has(result.product.slug)) toUpdate.push(result.product);
        else toInsert.push(result.product);
      }

      let created = 0;
      let updated = 0;

      if (toInsert.length) {
        const { error, data } = await supabase
          .from("products")
          .insert(toInsert)
          .select("slug");
        if (error) errors.push(`Insert error: ${error.message}`);
        else created = data?.length ?? toInsert.length;
      }

      for (const product of toUpdate) {
        const { slug, ...rest } = product;
        const { error } = await supabase.from("products").update(rest).eq("slug", slug);
        if (error) errors.push(`Update ${slug}: ${error.message}`);
        else updated += 1;
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      const summary = `Imported ${created} new · Updated ${updated} existing${
        errors.length ? ` · ${errors.length} error${errors.length === 1 ? "" : "s"}` : ""
      }`;
      setLastReport(summary + (errors.length ? `\n${errors.slice(0, 5).join("\n")}` : ""));
      if (errors.length) toast.error(summary);
      else toast.success(summary);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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
    <div className="mx-auto max-w-6xl px-6 lg:px-10 py-14">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="eyebrow text-foreground/60">Admin</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl">Products</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg">
            All {products.length} pieces live in a single database. Add, edit,
            import, export or remove them here — changes appear across the shop
            immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setEditing(null);
              setShowForm((v) => !v);
            }}
            variant={showForm && !editing ? "outline" : "default"}
          >
            {showForm && !editing ? <X /> : <Plus />}
            {showForm && !editing ? "Cancel" : "New product"}
          </Button>
        </div>
      </div>

      {/* Shop-wide settings */}
      <div className="mt-8 flex items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
        <input
          id="hide-oos"
          type="checkbox"
          checked={hideOutOfStock}
          disabled={updateSetting.isPending}
          onChange={(e) => {
            const next = e.target.checked;
            updateSetting.mutate(
              { key: "hide_out_of_stock", value: next },
              {
                onSuccess: () =>
                  toast.success(
                    next
                      ? "Out-of-stock products hidden from the shop"
                      : "Out-of-stock products visible in the shop",
                  ),
                onError: (err) =>
                  toast.error(err instanceof Error ? err.message : "Failed to update"),
              },
            );
          }}
          className="h-4 w-4 accent-foreground"
        />
        <Label htmlFor="hide-oos" className="cursor-pointer text-sm">
          Hide out-of-stock products from the shop pages
        </Label>
      </div>


      {/* Inline create / edit form */}
      {(showForm || editing) && (
        <div className="mt-10 border border-border p-6 lg:p-8 bg-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl">
              {editing ? `Edit — ${editing.name}` : "New product"}
            </h2>
            {editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(null)}
              >
                <X /> Close
              </Button>
            )}
          </div>
          <ProductForm
            key={editing?.slug ?? "new"}
            initial={editing}
            onDone={(slug) => {
              setShowForm(false);
              setEditing(null);
              queryClient.invalidateQueries({ queryKey: ["products"] });
              if (!editing) navigate({ to: "/product/$slug", params: { slug } });
            }}
          />
        </div>
      )}

      {/* Filters + Import/Export bar */}
      <div className="mt-12 rule" />
      <div className="mt-10 grid gap-3 md:grid-cols-[1fr_16rem_auto]">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, slug or SKU…"
            className="pl-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">All categories</option>
          {sortedCategories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy !== null}
          >
            {busy === "import" ? <Loader2 className="animate-spin" /> : <Upload />}
            Import CSV
          </Button>
          <Button
            variant="outline"
            onClick={onExport}
            disabled={busy !== null || filtered.length === 0}
          >
            {busy === "export" ? <Loader2 className="animate-spin" /> : <Download />}
            Export CSV
          </Button>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {filtered.length} of {products.length} products match
      </p>

      {lastReport && (
        <pre className="mt-4 whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-4 text-xs text-foreground/80">
          {lastReport}
        </pre>
      )}

      <ul className="mt-6 divide-y divide-border border-y border-border">
        {filtered.slice(0, 200).map((p) => {
          const stock = totalStock(p);
          const oos = stock <= 0;
          return (
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
              <div className="text-right">
                <div className="text-sm tabular-nums">{formatPrice(p.price)}</div>
                <div
                  className={`text-[10px] uppercase tracking-[0.16em] ${
                    oos ? "text-destructive" : "text-foreground/60"
                  }`}
                >
                  {oos ? "Out of stock" : `${stock} in stock`}
                </div>
              </div>
              <button
                aria-label={`Edit ${p.name}`}
                onClick={() => {
                  setEditing(p);
                  setShowForm(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="p-2 text-foreground/60 hover:text-foreground transition"
              >
                <Pencil size={16} />
              </button>
              <button
                aria-label={`Delete ${p.name}`}
                onClick={() => onDelete(p.slug, p.name)}
                className="p-2 text-foreground/60 hover:text-destructive transition"
              >
                <Trash2 size={16} />
              </button>
            </li>
          );
        })}
      </ul>
      {filtered.length > 200 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Showing first 200 of {filtered.length}. Narrow the search or category to see more.
        </p>
      )}
      {filtered.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">No products match the filter.</p>
      )}
    </div>
  );
}

// -------------------- Shared create / edit form --------------------

function ProductForm({
  initial,
  onDone,
}: {
  initial: Product | null;
  onDone: (slug: string) => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [stock, setStock] = useState(initial ? String(initial.stock ?? 0) : "0");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [cats, setCats] = useState<string[]>(initial?.categories ?? []);
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasVariants, setHasVariants] = useState(
    !!initial && isVariable(initial),
  );
  const [variants, setVariants] = useState<
    Array<{ size: string; sku: string; price: string; stock: string }>
  >(
    initial?.variants.map((v) => ({
      size: v.size,
      sku: v.sku ?? "",
      price: String(v.price),
      stock: String(v.stock ?? 0),
    })) ?? [],
  );
  const [customSize, setCustomSize] = useState("");

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
      return [...prev, { size, sku: "", price: price || "", stock: "0" }];
    });
  }

  function addCustomSize() {
    const size = customSize.trim();
    if (!size) return;
    if (variants.some((v) => v.size.toLowerCase() === size.toLowerCase())) {
      toast.error(`Size "${size}" already added`);
      return;
    }
    setVariants((prev) => [...prev, { size, sku: "", price: price || "", stock: "0" }]);
    setCustomSize("");
  }

  function removeVariant(size: string) {
    setVariants((prev) => prev.filter((v) => v.size !== size));
  }

  function updateVariant(
    size: string,
    patch: Partial<{ sku: string; price: string; stock: string }>,
  ) {
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
      stock,
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
      stock: v.stock,
    }));

    const row: Omit<Product, never> = {
      slug: result.data.slug,
      name: result.data.name,
      sku: result.data.sku ?? "",
      price: result.data.price,
      stock: hasVariants ? 0 : result.data.stock,
      description: result.data.description ?? "",
      categories: result.data.categories,
      images: result.data.images,
      variants: cleanVariants,
    };

    if (isEdit && initial) {
      const { slug: newSlug, ...rest } = row;
      const { error } = await supabase
        .from("products")
        .update({ ...rest, slug: newSlug })
        .eq("slug", initial.slug);
      setSubmitting(false);
      if (error) {
        if (error.code === "23505") {
          setErrors({ slug: `A product with the slug "${newSlug}" already exists.` });
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("Changes saved");
      onDone(row.slug);
    } else {
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
      onDone(row.slug);
    }
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
        {!hasVariants && (
          <Field label="Stock" error={errors.stock} hint="Units on hand">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="0"
            />
          </Field>
        )}
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
              Select the sizes this piece is offered in, then set a price and stock
              for each. The base price above is used as the shop card "from" price.
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
            <div className="flex gap-2 items-center">
              <Input
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomSize();
                  }
                }}
                placeholder="Custom size (e.g. XL, 38, One Size)"
                maxLength={40}
                className="max-w-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomSize}>
                Add size
              </Button>
            </div>
            {variants.length > 0 && (
              <div className="grid gap-2">
                <div className="grid grid-cols-[6rem_1fr_1fr_6rem_auto] gap-3 text-[10px] uppercase tracking-[0.16em] text-foreground/60">
                  <span>Size</span>
                  <span>SKU</span>
                  <span>Price (LKR)</span>
                  <span>Stock</span>
                  <span />
                </div>
                {variants.map((v) => (
                  <div
                    key={v.size}
                    className="grid grid-cols-[6rem_1fr_1fr_6rem_auto] gap-3 items-center"
                  >
                    <div className="text-sm font-medium truncate" title={v.size}>{v.size}</div>
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
                      placeholder="Price"
                      value={v.price}
                      onChange={(e) => updateVariant(v.size, { price: e.target.value })}
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      placeholder="0"
                      value={v.stock}
                      onChange={(e) => updateVariant(v.size, { stock: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeVariant(v.size)}
                      aria-label={`Remove ${v.size}`}
                      className="p-2 text-foreground/60 hover:text-destructive"
                    >
                      <X size={14} />
                    </button>
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
          {submitting ? (
            <><Loader2 className="animate-spin" /> {isEdit ? "Saving…" : "Creating…"}</>
          ) : (
            isEdit ? "Save changes" : "Create product"
          )}
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
