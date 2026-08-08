import { formatPrice } from "@/lib/products";
import type { ProductStats } from "@/lib/admin-products.types";

function Card({
  label,
  value,
  tone = "default",
  onClick,
  active,
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "danger" | "muted";
  onClick?: () => void;
  active?: boolean;
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { onClick, type: "button" as const } : {})}
      className={`rounded-md border bg-card px-4 py-3 text-left transition ${
        active ? "border-foreground" : "border-border"
      } ${onClick ? "hover:border-foreground" : ""}`}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-xl tabular-nums ${toneClass}`}>{value}</div>
    </Tag>
  );
}

export function StatsCards({
  stats,
  onQuickFilter,
  activeQuickFilter,
}: {
  stats: ProductStats;
  onQuickFilter?: (kind: "all" | "published" | "draft" | "out" | "low") => void;
  activeQuickFilter?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <Card
        label="Total"
        value={String(stats.total)}
        onClick={onQuickFilter ? () => onQuickFilter("all") : undefined}
        active={activeQuickFilter === "all"}
      />
      <Card
        label="Published"
        value={String(stats.active)}
        onClick={onQuickFilter ? () => onQuickFilter("published") : undefined}
        active={activeQuickFilter === "published"}
      />
      <Card
        label="Draft"
        value={String(stats.draft)}
        tone="muted"
        onClick={onQuickFilter ? () => onQuickFilter("draft") : undefined}
        active={activeQuickFilter === "draft"}
      />
      <Card
        label="Out of stock"
        value={String(stats.outOfStock)}
        tone="danger"
        onClick={onQuickFilter ? () => onQuickFilter("out") : undefined}
        active={activeQuickFilter === "out"}
      />
      <Card
        label="Low stock"
        value={String(stats.lowStock)}
        tone="warn"
        onClick={onQuickFilter ? () => onQuickFilter("low") : undefined}
        active={activeQuickFilter === "low"}
      />
      <Card label="Inventory value" value={formatPrice(stats.inventoryValue)} />
      <Card label="Average price" value={formatPrice(stats.averagePrice)} />
    </div>
  );
}
