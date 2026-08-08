import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Columns3, History, Loader2, Command as CommandIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import {
  useSiteSettings,
  useUpdateSiteSetting,
  DEFAULT_SHIPPING_NOTE,
} from "@/lib/site-settings";
import {
  COLUMNS,
  DEFAULT_COLUMNS,
  DEFAULT_FILTERS,
  PAGE_SIZES,
  adminProductSchema,
  type AdminProduct,
  type BulkAction,
  type ColumnKey,
  type ListFilters,
  type SortField,
} from "@/lib/admin-products.types";
import {
  useAdminList,
  useAdminMeta,
  useAdminPrefs,
  useApplyPatches,
  useAuditLog,
  useBulkAction,
  useExportProducts,
  useRestoreProducts,
  useSaveProduct,
  useSavePrefs,
} from "@/lib/admin-products-client";
import { downloadCsv, toCsv } from "@/lib/admin-products-csv";
import { StatsCards } from "@/components/admin/products/StatsCards";
import { FiltersBar, type SavedFilter } from "@/components/admin/products/FiltersBar";
import { ProductTable, type QuickPatch } from "@/components/admin/products/ProductTable";
import { BulkBar } from "@/components/admin/products/BulkBar";
import { ProductEditor } from "@/components/admin/products/ProductEditor";
import { ImportExportPanel } from "@/components/admin/products/ImportExportPanel";
import { CommandPalette } from "@/components/admin/products/CommandPalette";

export const Route = createFileRoute("/admin/products")({
  head: () => ({
    meta: [
      { title: "Manage products — Tallentire House" },
      {
        name: "description",
        content:
          "Admin workspace for the Tallentire House catalogue: search, filter, bulk-edit and publish products.",
      },
      { property: "og:title", content: "Manage products — Tallentire House" },
      {
        property: "og:description",
        content: "Admin workspace for the Tallentire House catalogue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminProductsPage,
});

function AdminProductsPage() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const enabled = !!user && isAdmin;

  const [filters, setFilters] = useState<ListFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [columns, setColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const list = useAdminList(filters, enabled);
  const meta = useAdminMeta(enabled);
  const prefs = useAdminPrefs(enabled);
  const savePrefs = useSavePrefs();
  const bulk = useBulkAction();
  const applyPatches = useApplyPatches();
  const restore = useRestoreProducts();
  const saveProduct = useSaveProduct();
  const exporter = useExportProducts();
  const audit = useAuditLog(enabled && showAudit);
  const { hideOutOfStock, productShippingNote } = useSiteSettings();
  const updateSetting = useUpdateSiteSetting();
  const [noteDraft, setNoteDraft] = useState(productShippingNote);
  useEffect(() => setNoteDraft(productShippingNote), [productShippingNote]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Hydrate persisted preferences once.
  useEffect(() => {
    const p = prefs.data;
    if (!p) return;
    if (p.visible_columns.length) setColumns(p.visible_columns as ColumnKey[]);
    setFavourites(p.favourites);
    setSavedFilters(p.saved_filters);
    setFilters((f) => ({ ...f, pageSize: p.page_size as ListFilters["pageSize"] }));
  }, [prefs.data]);

  const patchFilters = useCallback((patch: Partial<ListFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("admin-product-search")?.focus();
      } else if (e.key === "n") {
        e.preventDefault();
        setCreating(true);
        setEditing(null);
      } else if (e.key === "Escape") {
        setSelected(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const persist = (patch: Parameters<typeof savePrefs.mutate>[0]) => savePrefs.mutate(patch);

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const allOnPage = rows.every((r) => prev.has(r.id));
      const next = new Set(prev);
      for (const r of rows) {
        if (allOnPage) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }, [rows]);

  async function selectAllMatching() {
    try {
      const all = await exporter.mutateAsync(filters);
      setSelected(new Set(all.map((p) => p.id)));
      toast.success(`Selected ${all.length} products`);
    } catch {
      toast.error("Could not select all matching products");
    }
  }

  async function runBulk(action: BulkAction) {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      const res = await bulk.mutateAsync({ ids, action });
      setSelected(new Set());
      if (action.type === "delete" && res.deleted.length) {
        const deleted = res.deleted;
        toast.success(`Deleted ${deleted.length} products`, {
          action: {
            label: "Undo",
            onClick: () => {
              restore
                .mutateAsync(deleted)
                .then(() => toast.success("Products restored"))
                .catch(() => toast.error("Could not restore the products"));
            },
          },
        });
        return;
      }
      toast.success(`Updated ${res.affected} products`, {
        action: res.undo.length
          ? {
              label: "Undo",
              onClick: () => {
                applyPatches
                  .mutateAsync({ patches: res.undo, reason: `undo ${action.type}` })
                  .then(() => toast.success("Change reverted"))
                  .catch(() => toast.error("Could not revert the change"));
              },
            }
          : undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk action failed");
    }
  }

  async function quickSave(p: AdminProduct, quick: QuickPatch) {
    const {
      id: _id,
      total_stock: _ts,
      created_at: _c,
      updated_at: _u,
      ...rest
    } = p;
    const parsed = adminProductSchema.safeParse({ ...rest, ...quick });
    if (!parsed.success) {
      toast.error("Those values are not valid");
      return;
    }
    const before = { price: p.price, stock: p.stock };
    try {
      await saveProduct.mutateAsync(parsed.data);
      toast.success(`${p.name} updated`, {
        action: {
          label: "Undo",
          onClick: () => {
            applyPatches
              .mutateAsync({
                patches: [{ id: p.id, patchJson: JSON.stringify(before) }],
                reason: "undo quick edit",
              })
              .then(() => toast.success("Change reverted"))
              .catch(() => toast.error("Could not revert the change"));
          },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  function toggleFavourite(slug: string) {
    setFavourites((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      persist({ favourites: next });
      return next;
    });
  }

  async function exportSelection() {
    const chosen = rows.filter((r) => selected.has(r.id));
    if (!chosen.length) {
      toast.error("Nothing selected on this page to export");
      return;
    }
    downloadCsv(toCsv(chosen), `products-selection-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-20 text-sm text-muted-foreground">
        Loading…
      </main>
    );
  }
  if (!user) return null;
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <p className="eyebrow text-foreground/60">Access denied</p>
        <h1 className="mt-3 font-display text-3xl">Admin role required</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account doesn't have admin privileges. Ask an existing admin to grant you access.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/">
            <Button variant="outline">Back to shop</Button>
          </Link>
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
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[110rem] px-6 py-12 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow text-foreground/60">Admin</p>
          <h1 className="mt-2 font-display text-4xl">Products</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Search, filter, bulk-edit and publish the catalogue. Press{" "}
            <kbd className="rounded border border-border px-1">/</kbd> to search,{" "}
            <kbd className="rounded border border-border px-1">n</kbd> for a new product,{" "}
            <kbd className="rounded border border-border px-1">⌘K</kbd> for the command palette.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setPaletteOpen(true)}>
            <CommandIcon /> Command palette
          </Button>
          <Button variant="outline" onClick={() => setShowAudit((v) => !v)}>
            <History /> Activity
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Columns3 /> Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              {COLUMNS.map((c) => {
                const checked = columns.includes(c.key);
                const locked = "always" in c && c.always;
                return (
                  <label
                    key={c.key}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent/50"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={locked}
                      onCheckedChange={() => {
                        const next = checked
                          ? columns.filter((k) => k !== c.key)
                          : [...COLUMNS.map((x) => x.key)].filter(
                              (k) => columns.includes(k) || k === c.key,
                            );
                        setColumns(next);
                        persist({ visible_columns: next });
                      }}
                    />
                    <span>{c.label}</span>
                  </label>
                );
              })}
            </PopoverContent>
          </Popover>
          <Button
            onClick={() => {
              setEditing(null);
              setCreating((v) => !v);
            }}
          >
            <Plus /> New product
          </Button>
        </div>
      </div>

      {meta.data && (
        <div className="mt-8">
          <StatsCards
            stats={meta.data.stats}
            onQuickFilter={(kind) => {
              if (kind === "all") patchFilters({ ...DEFAULT_FILTERS });
              if (kind === "published")
                patchFilters({ statuses: ["published"], stockStatus: "any", page: 1 });
              if (kind === "draft")
                patchFilters({ statuses: ["draft"], stockStatus: "any", page: 1 });
              if (kind === "out") patchFilters({ statuses: [], stockStatus: "out", page: 1 });
              if (kind === "low") patchFilters({ statuses: [], stockStatus: "low", page: 1 });
            }}
          />
        </div>
      )}

      {/* Shop-wide settings */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
          <Checkbox
            id="hide-oos"
            checked={hideOutOfStock}
            disabled={updateSetting.isPending}
            onCheckedChange={(v) =>
              updateSetting.mutate(
                { key: "hide_out_of_stock", value: v === true },
                {
                  onSuccess: () => toast.success("Shop visibility updated"),
                  onError: () => toast.error("Could not update the setting"),
                },
              )
            }
          />
          <Label htmlFor="hide-oos" className="cursor-pointer text-sm">
            Hide out-of-stock products from the shop pages
          </Label>
        </div>
        <div className="space-y-2 rounded-md border border-border bg-muted/30 px-4 py-3">
          <Label htmlFor="shipping-note" className="text-sm">
            Shipping note shown on every in-stock product page
          </Label>
          <Textarea
            id="shipping-note"
            rows={2}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder={DEFAULT_SHIPPING_NOTE}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={updateSetting.isPending || noteDraft === productShippingNote}
              onClick={() =>
                updateSetting.mutate(
                  { key: "product_shipping_note", value: noteDraft },
                  {
                    onSuccess: () => toast.success("Shipping note saved"),
                    onError: () => toast.error("Could not save the note"),
                  },
                )
              }
            >
              Save note
            </Button>
            <Button size="sm" variant="outline" onClick={() => setNoteDraft(DEFAULT_SHIPPING_NOTE)}>
              Reset to default
            </Button>
          </div>
        </div>
      </div>

      <Sheet
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setCreating(false);
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-4xl lg:max-w-5xl overflow-y-auto p-0">
          <ProductEditor
            key={editing?.id ?? "new"}
            className="h-full border-0 bg-transparent rounded-none"
            initial={editing}
            onClose={() => {
              setEditing(null);
              setCreating(false);
            }}
            onSaved={() => {
              if (creating) {
                setCreating(false);
              }
            }}
          />
        </SheetContent>
      </Sheet>

      {showAudit && (
        <div className="mt-8 rounded-md border border-border">
          <h2 className="border-b border-border px-4 py-3 font-display text-lg">
            Recent activity
          </h2>
          {audit.isLoading && (
            <p className="px-4 py-4 text-sm text-muted-foreground">Loading…</p>
          )}
          <ul className="divide-y divide-border">
            {(audit.data ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap gap-2 px-4 py-2 text-sm">
                <span className="text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </span>
                <span className="text-muted-foreground">· {a.actor_label} ·</span>
                <span>{a.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <FiltersBar
          filters={filters}
          onChange={patchFilters}
          facets={meta.data?.facets ?? { brands: [], collections: [], suppliers: [], tags: [] }}
          categories={meta.data?.categories ?? []}
          savedFilters={savedFilters}
          onSaveFilter={(name) => {
            const next = [
              ...savedFilters.filter((f) => f.name !== name),
              { name, filtersJson: JSON.stringify(filters) },
            ].slice(0, 30);
            setSavedFilters(next);
            persist({ saved_filters: next });
            toast.success(`Preset "${name}" saved`);
          }}
          onDeleteFilter={(name) => {
            const next = savedFilters.filter((f) => f.name !== name);
            setSavedFilters(next);
            persist({ saved_filters: next });
          }}
          resultCount={total}
        />
      </div>

      <div className="mt-4">
        <ProductTable
          rows={rows}
          columns={columns}
          sort={filters.sort}
          dir={filters.dir}
          onSort={(field: SortField) =>
            patchFilters({
              sort: field,
              dir: filters.sort === field && filters.dir === "asc" ? "desc" : "asc",
              page: 1,
            })
          }
          selected={selected}
          onToggle={toggleRow}
          onToggleAll={toggleAll}
          onEdit={(p) => {
            setCreating(false);
            setEditing(p);
          }}
          onQuickSave={quickSave}
          favourites={favourites}
          onToggleFavourite={toggleFavourite}
          loading={list.isLoading}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {list.isFetching && <Loader2 className="animate-spin" size={14} />}
          Page {filters.page} of {pageCount}
          <select
            value={filters.pageSize}
            aria-label="Rows per page"
            onChange={(e) => {
              const pageSize = Number(e.target.value) as ListFilters["pageSize"];
              patchFilters({ pageSize, page: 1 });
              persist({ page_size: pageSize });
            }}
            className="ml-2 h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} per page
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => patchFilters({ page: filters.page - 1 })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= pageCount}
            onClick={() => patchFilters({ page: filters.page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-display text-xl">Import &amp; export</h2>
        <ImportExportPanel filters={filters} />
      </div>

      <BulkBar
        count={selected.size}
        total={total}
        allMatchingSelected={selected.size >= total && total > 0}
        onSelectAllMatching={() => void selectAllMatching()}
        onClear={() => setSelected(new Set())}
        onRun={(a) => void runBulk(a)}
        onExportSelection={() => void exportSelection()}
        busy={bulk.isPending}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        products={rows}
        commands={[
          {
            id: "new",
            label: "New product",
            run: () => {
              setEditing(null);
              setCreating(true);
            },
          },
          {
            id: "clear",
            label: "Clear all filters",
            run: () => setFilters(DEFAULT_FILTERS),
          },
          {
            id: "oos",
            label: "Show out-of-stock products",
            run: () => patchFilters({ stockStatus: "out", page: 1 }),
          },
          {
            id: "drafts",
            label: "Show drafts",
            run: () => patchFilters({ statuses: ["draft"], page: 1 }),
          },
          {
            id: "activity",
            label: "Toggle activity log",
            run: () => setShowAudit((v) => !v),
          },
        ]}
        onPick={(p) => {
          setCreating(false);
          setEditing(p);
        }}
      />
    </main>
  );
}
