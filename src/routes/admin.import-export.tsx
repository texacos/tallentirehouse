import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload, Trash2, Loader2, ArrowLeft, Search } from "lucide-react";
import Papa from "papaparse";
import {
  CATEGORIES,
  formatPrice,
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

export const Route = createFileRoute("/admin/import-export")({
  head: () => ({
    meta: [
      { title: "Import / Export products — Tallentire House" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQueryOptions),
  component: ImportExportPage,
});

// Columns written and read from CSV. Kept flat so spreadsheets stay usable.
const CSV_COLUMNS = [
  "slug",
  "name",
  "sku",
  "price",
  "stock",
  "description",
  "categories", // pipe-separated
  "images", // pipe-separated URLs/paths
  "variants", // JSON string of ProductVariant[]
] as const;

type CsvRow = Record<(typeof CSV_COLUMNS)[number], string>;

function productToCsvRow(p: Product): CsvRow {
  return {
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    price: String(p.price),
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

function csvRowToProduct(row: Partial<Record<string, string>>): {
  ok: true;
  product: Omit<Product, never>;
} | { ok: false; error: string } {
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

function ImportExportPage() {
  const products = useProducts();
  const queryClient = useQueryClient();
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(""); // slug or ""
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<null | "import" | "export" | "delete">(null);
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

  const allChecked = filtered.length > 0 && filtered.every((p) => selected.has(p.slug));
  const someChecked = filtered.some((p) => selected.has(p.slug));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        for (const p of filtered) next.delete(p.slug);
      } else {
        for (const p of filtered) next.add(p.slug);
      }
      return next;
    });
  }

  function toggleOne(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

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
      if (parsed.errors.length) {
        toast.error(`CSV parse error: ${parsed.errors[0].message}`);
      }
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
        const { error, data } = await supabase.from("products").insert(toInsert).select("slug");
        if (error) {
          errors.push(`Insert error: ${error.message}`);
        } else {
          created = data?.length ?? toInsert.length;
        }
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

  async function onDeleteSelected() {
    const slugs = Array.from(selected).filter((s) => filtered.some((p) => p.slug === s));
    if (slugs.length === 0) {
      toast.error("Tick at least one product to delete");
      return;
    }
    if (
      !confirm(
        `Delete ${slugs.length} product${slugs.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    )
      return;
    setBusy("delete");
    setLastReport(null);
    const { error, count } = await supabase
      .from("products")
      .delete({ count: "exact" })
      .in("slug", slugs);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const deleted = count ?? slugs.length;
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["products"] });
    const msg = `Deleted ${deleted} product${deleted === 1 ? "" : "s"}`;
    setLastReport(msg);
    toast.success(msg);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-20 text-sm text-muted-foreground">Loading…</div>
    );
  }
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <p className="eyebrow text-foreground/60">Access denied</p>
        <h1 className="mt-3 font-display text-3xl">Admin role required</h1>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/"><Button variant="outline">Back to shop</Button></Link>
          <Button
            variant="ghost"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 lg:px-10 py-14">
      <Link
        to="/admin/products"
        className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-foreground/60 hover:text-foreground"
      >
        <ArrowLeft size={14} /> Back to products
      </Link>

      <div className="mt-6 flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="eyebrow text-foreground/60">Admin</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl">Import / Export</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-xl">
            Move products in and out of the shop as CSV, or bulk-delete a filtered
            selection. Rows are matched by <code className="text-foreground">slug</code>:
            an existing slug is updated in place; a new slug is inserted.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-10 grid gap-3 md:grid-cols-[1fr_18rem]">
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
        <div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">All categories</option>
            {sortedCategories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {filtered.length} of {products.length} products match
        {selected.size > 0 && ` · ${selected.size} selected`}
      </p>

      {/* Actions */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <ActionCard
          title="Export CSV"
          description="Download the filtered products as a spreadsheet."
          icon={<Download size={16} />}
          action={
            <Button onClick={onExport} disabled={busy !== null || filtered.length === 0}>
              {busy === "export" ? <Loader2 className="animate-spin" /> : <Download />}
              Export {filtered.length}
            </Button>
          }
        />
        <ActionCard
          title="Import CSV"
          description="Existing slugs are updated; new slugs are inserted."
          icon={<Upload size={16} />}
          action={
            <>
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
                Choose file…
              </Button>
            </>
          }
        />
        <ActionCard
          title="Delete selected"
          description="Only ticked rows within the current filter are removed."
          icon={<Trash2 size={16} />}
          action={
            <Button
              variant="destructive"
              onClick={onDeleteSelected}
              disabled={busy !== null || !someChecked}
            >
              {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete {selected.size}
            </Button>
          }
        />
      </div>

      {lastReport && (
        <pre className="mt-6 whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-4 text-xs text-foreground/80">
          {lastReport}
        </pre>
      )}

      {/* Results table */}
      <div className="mt-10 rule" />
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-foreground/60">
              <th className="py-2 pr-3 w-8">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  aria-label="Select all filtered"
                  className="accent-foreground"
                />
              </th>
              <th className="py-2 pr-3">Product</th>
              <th className="py-2 pr-3">SKU</th>
              <th className="py-2 pr-3">Price</th>
              <th className="py-2 pr-3">Stock</th>
              <th className="py-2 pr-3">Categories</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.slice(0, 300).map((p) => {
              const checked = selected.has(p.slug);
              const totalStock = isVariable(p)
                ? p.variants.reduce((n, v) => n + (v.stock ?? 0), 0)
                : p.stock;
              return (
                <tr key={p.slug} className={checked ? "bg-accent/30" : undefined}>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(p.slug)}
                      aria-label={`Select ${p.name}`}
                      className="accent-foreground"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 bg-muted overflow-hidden">
                        {p.images[0] && (
                          <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{p.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-xs">{p.sku || "—"}</td>
                  <td className="py-2 pr-3 tabular-nums text-xs">{formatPrice(p.price)}</td>
                  <td className="py-2 pr-3 tabular-nums text-xs">
                    {totalStock}
                    {isVariable(p) && (
                      <span className="ml-1 text-foreground/40">({p.variants.length}v)</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-[11px] text-muted-foreground truncate max-w-[16rem]">
                    {p.categories.join(", ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 300 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing first 300 of {filtered.length}. Narrow the search or category to see more.
          </p>
        )}
        {filtered.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">No products match the filter.</p>
        )}
      </div>
    </div>
  );
}

function ActionCard({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-md p-5 bg-card flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-foreground/70">
        {icon}
        <Label className="text-xs uppercase tracking-[0.18em]">{title}</Label>
      </div>
      <p className="text-xs text-muted-foreground flex-1">{description}</p>
      <div>{action}</div>
    </div>
  );
}
