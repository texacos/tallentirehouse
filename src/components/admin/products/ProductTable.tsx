import { memo, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, Pencil, Star, Zap, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatPrice, getCategoryLabel } from "@/lib/products";
import {
  COLUMNS,
  SORT_FIELDS,
  STATUS_LABEL,
  STOCK_LEVEL_LABEL,
  isVisible,
  stockLevel,
  stockOf,
  type AdminProduct,
  type ColumnKey,
  type SortField,
} from "@/lib/admin-products.types";

const WIDTHS: Record<ColumnKey, string> = {
  image: "4rem",
  name: "minmax(14rem, 2fr)",
  sku: "7rem",
  category: "minmax(8rem, 1fr)",
  price: "6rem",
  sale_price: "6rem",
  stock: "5rem",
  stock_status: "7rem",
  status: "7rem",
  visibility: "6rem",
  updated_at: "8rem",
};

const SORT_FOR: Partial<Record<ColumnKey, SortField>> = {
  name: "name",
  sku: "sku",
  price: "price",
  stock: "total_stock",
  updated_at: "updated_at",
};

const STOCK_TONE: Record<string, string> = {
  in: "text-emerald-600 dark:text-emerald-400",
  low: "text-amber-600 dark:text-amber-400",
  out: "text-destructive",
  archived: "text-muted-foreground",
};

export type QuickPatch = { price?: number; sale_price?: number | null; stock?: number };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

const Row = memo(function Row({
  p,
  columns,
  selected,
  onToggle,
  onEdit,
  onQuickSave,
  favourite,
  onToggleFavourite,
}: {
  p: AdminProduct;
  columns: ColumnKey[];
  selected: boolean;
  onToggle: (id: string, shiftKey: boolean) => void;
  onEdit: (p: AdminProduct) => void;
  onQuickSave: (p: AdminProduct, patch: QuickPatch) => void;
  favourite: boolean;
  onToggleFavourite: (slug: string) => void;
}) {
  const [quick, setQuick] = useState<null | { price: string; stock: string }>(null);
  const level = stockLevel(p);
  const units = stockOf(p);

  const cell = (key: ColumnKey) => {
    switch (key) {
      case "image":
        return (
          <div className="h-10 w-10 overflow-hidden rounded bg-muted">
            {p.images[0] && (
              <img
                src={p.images[0]}
                alt={p.image_alts[0] ?? ""}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )}
          </div>
        );
      case "name":
        return (
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onEdit(p)}
              className="block truncate text-left font-medium underline-offset-4 hover:underline"
            >
              {p.name}
            </button>
            <p className="truncate text-xs text-muted-foreground">
              {p.brand ? `${p.brand} · ` : ""}
              {p.variants.length ? `${p.variants.length} variants` : "Simple product"}
            </p>
          </div>
        );
      case "sku":
        return <span className="truncate text-xs tabular-nums">{p.sku || "—"}</span>;
      case "category":
        return (
          <span className="truncate text-xs text-muted-foreground">
            {p.categories.map(getCategoryLabel).join(", ") || "—"}
          </span>
        );
      case "price":
        return <span className="tabular-nums text-sm">{formatPrice(p.price)}</span>;
      case "sale_price":
        return (
          <span className="tabular-nums text-sm">
            {p.sale_price == null ? "—" : formatPrice(p.sale_price)}
          </span>
        );
      case "stock":
        return <span className="tabular-nums text-sm">{units}</span>;
      case "stock_status":
        return (
          <span className={`text-[11px] uppercase tracking-[0.14em] ${STOCK_TONE[level]}`}>
            {STOCK_LEVEL_LABEL[level]}
          </span>
        );
      case "status":
        return (
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {STATUS_LABEL[p.status]}
          </span>
        );
      case "visibility":
        return (
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {isVisible(p) ? "Live" : "Hidden"}
          </span>
        );
      case "updated_at":
        return (
          <span className="text-xs text-muted-foreground">{fmtDate(p.updated_at)}</span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`border-b border-border ${selected ? "bg-accent/30" : ""}`}>
      <div
        className="grid items-center gap-3 px-3 py-2"
        style={{
          gridTemplateColumns: `2rem ${columns.map((c) => WIDTHS[c]).join(" ")} 8.5rem`,
        }}
      >
        <Checkbox
          checked={selected}
          aria-label={`Select ${p.name}`}
          onClick={(e) => onToggle(p.id, (e as unknown as MouseEvent).shiftKey)}
        />
        {columns.map((c) => (
          <div key={c} className="min-w-0">
            {cell(c)}
          </div>
        ))}
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="min-h-9 min-w-9"
            aria-label={favourite ? `Unfavourite ${p.name}` : `Favourite ${p.name}`}
            onClick={() => onToggleFavourite(p.slug)}
          >
            <Star size={15} className={favourite ? "fill-current" : ""} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-9 min-w-9"
            aria-label={`Quick edit ${p.name}`}
            onClick={() =>
              setQuick((v) =>
                v ? null : { price: String(p.price), stock: String(p.stock) },
              )
            }
          >
            <Zap size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-9 min-w-9"
            aria-label={`Edit ${p.name}`}
            onClick={() => onEdit(p)}
          >
            <Pencil size={15} />
          </Button>
        </div>
      </div>

      {quick && (
        <div className="flex flex-wrap items-end gap-3 border-t border-dashed border-border bg-muted/30 px-3 py-3">
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">Price (USD)</span>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={quick.price}
              onChange={(e) => setQuick({ ...quick, price: e.target.value })}
              className="h-8 w-28"
            />
          </label>
          {p.variants.length === 0 && (
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Stock</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={quick.stock}
                onChange={(e) => setQuick({ ...quick, stock: e.target.value })}
                className="h-8 w-24"
              />
            </label>
          )}
          <Button
            size="sm"
            onClick={() => {
              onQuickSave(p, {
                price: Math.max(0, Number(quick.price) || 0),
                ...(p.variants.length
                  ? {}
                  : { stock: Math.max(0, Math.trunc(Number(quick.stock) || 0)) }),
              });
              setQuick(null);
            }}
          >
            <Check /> Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setQuick(null)}>
            <X /> Cancel
          </Button>
        </div>
      )}
    </div>
  );
});

export function ProductTable({
  rows,
  columns,
  sort,
  dir,
  onSort,
  selected,
  onToggle,
  onToggleAll,
  onEdit,
  onQuickSave,
  favourites,
  onToggleFavourite,
  loading,
}: {
  rows: AdminProduct[];
  columns: ColumnKey[];
  sort: SortField;
  dir: "asc" | "desc";
  onSort: (field: SortField) => void;
  selected: Set<string>;
  onToggle: (id: string, shiftKey: boolean) => void;
  onToggleAll: () => void;
  onEdit: (p: AdminProduct) => void;
  onQuickSave: (p: AdminProduct, patch: QuickPatch) => void;
  favourites: string[];
  onToggleFavourite: (slug: string) => void;
  loading?: boolean;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualise = rows.length > 60;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 12,
  });
  const items = virtualizer.getVirtualItems();
  const favSet = useMemo(() => new Set(favourites), [favourites]);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const header = (
    <div
      className="sticky top-0 z-10 grid items-center gap-3 border-b border-border bg-background px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
      style={{
        gridTemplateColumns: `2rem ${columns.map((c) => WIDTHS[c]).join(" ")} 8.5rem`,
      }}
    >
      <Checkbox
        checked={allSelected}
        onCheckedChange={onToggleAll}
        aria-label="Select all rows on this page"
      />
      {columns.map((c) => {
        const field = SORT_FOR[c];
        const label = COLUMNS.find((x) => x.key === c)?.label ?? c;
        if (!field || !SORT_FIELDS.includes(field)) return <span key={c}>{label}</span>;
        const active = sort === field;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onSort(field)}
            className="flex items-center gap-1 text-left uppercase tracking-[0.16em] hover:text-foreground"
            aria-label={`Sort by ${label}`}
          >
            {label}
            {active &&
              (dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
          </button>
        );
      })}
      <span className="text-right">Actions</span>
    </div>
  );

  const renderRow = (p: AdminProduct) => (
    <Row
      key={p.id}
      p={p}
      columns={columns}
      selected={selected.has(p.id)}
      onToggle={onToggle}
      onEdit={onEdit}
      onQuickSave={onQuickSave}
      favourite={favSet.has(p.slug)}
      onToggleFavourite={onToggleFavourite}
    />
  );

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      {header}
      {loading && rows.length === 0 && (
        <p className="px-3 py-10 text-sm text-muted-foreground">Loading products…</p>
      )}
      {!loading && rows.length === 0 && (
        <p className="px-3 py-10 text-sm text-muted-foreground">
          No products match these filters.
        </p>
      )}
      {virtualise ? (
        <div ref={parentRef} className="max-h-[70vh] overflow-auto">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {items.map((item) => (
              <div
                key={item.key}
                ref={virtualizer.measureElement}
                data-index={item.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${item.start}px)`,
                }}
              >
                {renderRow(rows[item.index])}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>{rows.map(renderRow)}</div>
      )}
    </div>
  );
}
