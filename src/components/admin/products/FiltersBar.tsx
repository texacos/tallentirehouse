import { useEffect, useState } from "react";
import { Search, X, SlidersHorizontal, Star, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { getCategoryLabel } from "@/lib/products";
import {
  DEFAULT_FILTERS,
  PRODUCT_STATUSES,
  STATUS_LABEL,
  type ListFilters,
  type ProductFacets,
} from "@/lib/admin-products.types";

type Patch = Partial<ListFilters>;

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  renderLabel,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  renderLabel?: (value: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const shown = options.filter((o) =>
    (renderLabel?.(o) ?? o).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="justify-between">
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}…`}
          className="mb-2 h-8"
          aria-label={`Search ${label}`}
        />
        <div className="max-h-60 overflow-y-auto pr-1">
          {shown.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">Nothing to show.</p>
          )}
          {shown.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent/50"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() =>
                    onChange(
                      checked ? selected.filter((s) => s !== opt) : [...selected, opt],
                    )
                  }
                />
                <span className="truncate">{renderLabel?.(opt) ?? opt}</span>
              </label>
            );
          })}
        </div>
        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => onChange([])}
          >
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export type SavedFilter = { name: string; filtersJson: string };

export function FiltersBar({
  filters,
  onChange,
  facets,
  categories,
  savedFilters,
  onSaveFilter,
  onDeleteFilter,
  resultCount,
}: {
  filters: ListFilters;
  onChange: (patch: Patch) => void;
  facets: ProductFacets;
  categories: string[];
  savedFilters: SavedFilter[];
  onSaveFilter: (name: string) => void;
  onDeleteFilter: (name: string) => void;
  resultCount: number;
}) {
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const [advOpen, setAdvOpen] = useState(false);

  useEffect(() => setSearchDraft(filters.search), [filters.search]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchDraft !== filters.search) onChange({ search: searchDraft, page: 1 });
    }, 250);
    return () => clearTimeout(t);
  }, [searchDraft, filters.search, onChange]);

  const activeCount =
    filters.statuses.length +
    filters.categories.length +
    filters.brands.length +
    filters.collections.length +
    filters.suppliers.length +
    filters.tags.length +
    (filters.stockStatus !== "any" ? 1 : 0) +
    (filters.priceMin != null || filters.priceMax != null ? 1 : 0) +
    (filters.stockMin != null || filters.stockMax != null ? 1 : 0) +
    (filters.createdFrom || filters.createdTo ? 1 : 0) +
    (filters.updatedFrom || filters.updatedTo ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="admin-product-search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search name, SKU, barcode, brand, tags, description…"
            className="pl-9"
            aria-label="Search products"
          />
        </div>

        <MultiSelect
          label="Status"
          options={[...PRODUCT_STATUSES]}
          selected={filters.statuses}
          onChange={(next) => onChange({ statuses: next as ListFilters["statuses"], page: 1 })}
          renderLabel={(v) => STATUS_LABEL[v as keyof typeof STATUS_LABEL] ?? v}
        />
        <MultiSelect
          label="Category"
          options={categories}
          selected={filters.categories}
          onChange={(next) => onChange({ categories: next, page: 1 })}
          renderLabel={getCategoryLabel}
        />
        <MultiSelect
          label="Brand"
          options={facets.brands}
          selected={filters.brands}
          onChange={(next) => onChange({ brands: next, page: 1 })}
        />
        <MultiSelect
          label="Tags"
          options={facets.tags}
          selected={filters.tags}
          onChange={(next) => onChange({ tags: next, page: 1 })}
        />

        <select
          value={filters.stockStatus}
          onChange={(e) =>
            onChange({ stockStatus: e.target.value as ListFilters["stockStatus"], page: 1 })
          }
          aria-label="Stock status"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="any">Any stock</option>
          <option value="in">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>

        <Button
          variant={advOpen ? "default" : "outline"}
          size="sm"
          onClick={() => setAdvOpen((v) => !v)}
        >
          <SlidersHorizontal /> More
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeCount}
            </Badge>
          )}
        </Button>

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...DEFAULT_FILTERS, search: filters.search, page: 1 })}
          >
            <X /> Reset
          </Button>
        )}
      </div>

      {advOpen && (
        <div className="grid gap-4 rounded-md border border-border bg-muted/20 p-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs">Price range (USD)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                placeholder="Min"
                value={filters.priceMin ?? ""}
                onChange={(e) =>
                  onChange({
                    priceMin: e.target.value === "" ? null : Number(e.target.value),
                    page: 1,
                  })
                }
              />
              <Input
                type="number"
                min={0}
                placeholder="Max"
                value={filters.priceMax ?? ""}
                onChange={(e) =>
                  onChange({
                    priceMax: e.target.value === "" ? null : Number(e.target.value),
                    page: 1,
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Inventory level</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                placeholder="Min units"
                value={filters.stockMin ?? ""}
                onChange={(e) =>
                  onChange({
                    stockMin: e.target.value === "" ? null : Number(e.target.value),
                    page: 1,
                  })
                }
              />
              <Input
                type="number"
                min={0}
                placeholder="Max units"
                value={filters.stockMax ?? ""}
                onChange={(e) =>
                  onChange({
                    stockMax: e.target.value === "" ? null : Number(e.target.value),
                    page: 1,
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Collection / supplier</Label>
            <div className="flex gap-2">
              <MultiSelect
                label="Collection"
                options={facets.collections}
                selected={filters.collections}
                onChange={(next) => onChange({ collections: next, page: 1 })}
              />
              <MultiSelect
                label="Supplier"
                options={facets.suppliers}
                selected={filters.suppliers}
                onChange={(next) => onChange({ suppliers: next, page: 1 })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Created between</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={filters.createdFrom?.slice(0, 10) ?? ""}
                onChange={(e) =>
                  onChange({ createdFrom: e.target.value || null, page: 1 })
                }
              />
              <Input
                type="date"
                value={filters.createdTo?.slice(0, 10) ?? ""}
                onChange={(e) => onChange({ createdTo: e.target.value || null, page: 1 })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Updated between</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={filters.updatedFrom?.slice(0, 10) ?? ""}
                onChange={(e) =>
                  onChange({ updatedFrom: e.target.value || null, page: 1 })
                }
              />
              <Input
                type="date"
                value={filters.updatedTo?.slice(0, 10) ?? ""}
                onChange={(e) => onChange({ updatedTo: e.target.value || null, page: 1 })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Saved filter presets</Label>
            <div className="flex flex-wrap items-center gap-2">
              {savedFilters.map((f) => (
                <span
                  key={f.name}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs"
                >
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => {
                      try {
                        onChange({ ...JSON.parse(f.filtersJson), page: 1 });
                      } catch {
                        /* ignore malformed preset */
                      }
                    }}
                  >
                    <Star size={11} className="mr-1 inline" />
                    {f.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete preset ${f.name}`}
                    onClick={() => onDeleteFilter(f.name)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const name = window.prompt("Name this filter preset");
                  if (name?.trim()) onSaveFilter(name.trim().slice(0, 60));
                }}
              >
                <Save /> Save current
              </Button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {resultCount} product{resultCount === 1 ? "" : "s"} match
      </p>
    </div>
  );
}
