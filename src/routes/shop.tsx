import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { z } from "zod";
import {
  CATEGORIES,
  CATEGORY_GROUPS,
  type CategoryGroup,
  getCategoryLabel,
  resolveCategoryFilter,
} from "@/lib/products";
import { useAllProducts } from "@/lib/customProducts";
import { ProductCard } from "@/components/site/ProductCard";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";


const PAGE_SIZE = 48;

const searchSchema = z.object({
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export const Route = createFileRoute("/shop")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Shop — Tallentire House" },
      {
        name: "description",
        content:
          "Browse cushions, silk, ceramics, fabrics and homewares — each piece made by hand in small batches.",
      },
      { property: "og:title", content: "Shop the collection — Tallentire House" },
    ],
  }),
  component: Shop,
});

// Leaf slugs that belong to any group, so we can list "uncategorised" leaves separately.
const GROUPED_LEAVES = new Set(CATEGORY_GROUPS.flatMap((g) => g.children));
const UNGROUPED_CATEGORIES = CATEGORIES.filter((c) => !GROUPED_LEAVES.has(c.slug));

function Shop() {
  const { category, page = 1 } = Route.useSearch();

  const filtered = useMemo(() => {
    const leaves = resolveCategoryFilter(category);
    if (!leaves) return PRODUCTS;
    return PRODUCTS.filter((p) => p.categories.some((c) => leaves.includes(c)));
  }, [category]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const items = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const heading = category ? getCategoryLabel(category) : "The Collection";

  return (
    <div>
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-14 lg:py-20 text-center">
          <p className="eyebrow text-foreground/60">
            {category ? "Category" : `${PRODUCTS.length} pieces`}
          </p>
          <h1 className="mt-4 font-display text-5xl md:text-6xl">{heading}</h1>
          <p className="mx-auto mt-5 max-w-xl text-sm text-muted-foreground leading-relaxed">
            Every piece is made by hand in small batches in our workshops.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 lg:px-10 py-10 lg:py-14">
        <div className="grid lg:grid-cols-[240px_1fr] gap-10 lg:gap-14">
          {/* SIDEBAR / MOBILE ACCORDION */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <CategoryHierarchy activeSlug={category} />
          </aside>

          {/* GRID */}
          <div>
            <CategoryBreadcrumbs activeSlug={category} />
            <p className="eyebrow text-foreground/60 mb-6 mt-4">
              {filtered.length} {filtered.length === 1 ? "piece" : "pieces"}
            </p>
            {items.length === 0 ? (
              <div className="text-center py-24">
                <p className="font-display text-2xl">Nothing here yet.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-14">
                  {items.map((p) => (
                    <ProductCard key={p.slug} product={p} />
                  ))}
                </div>

                {pageCount > 1 && (
                  <div className="mt-16 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.2em]">
                    {current > 1 && (
                      <Link
                        to="/shop"
                        search={{ category, page: current - 1 }}
                        className="border border-foreground/30 px-4 py-2 hover:border-foreground"
                      >
                        Prev
                      </Link>
                    )}
                    <span className="px-3 text-foreground/60">
                      Page {current} of {pageCount}
                    </span>
                    {current < pageCount && (
                      <Link
                        to="/shop"
                        search={{ category, page: current + 1 }}
                        className="border border-foreground/30 px-4 py-2 hover:border-foreground"
                      >
                        Next
                      </Link>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function CategoryHierarchy({ activeSlug }: { activeSlug?: string }) {
  // A group is initially expanded if it's selected, or contains the selected leaf.
  const initialOpen = useMemo(() => {
    const set = new Set<string>();
    if (!activeSlug) return set;
    for (const g of CATEGORY_GROUPS) {
      if (g.slug === activeSlug || g.children.includes(activeSlug)) {
        set.add(g.slug);
      }
    }
    return set;
  }, [activeSlug]);

  const [open, setOpen] = useState<Set<string>>(initialOpen);
  const toggle = (slug: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });

  return (
    <nav aria-label="Categories" className="text-sm">
      <p className="eyebrow text-foreground/60 mb-4">Browse</p>

      <Link
        to="/shop"
        className={`block py-2 border-b border-border/50 ${
          !activeSlug ? "text-foreground font-medium" : "text-foreground/70 hover:text-foreground"
        }`}
      >
        All pieces
        <span className="ml-2 text-foreground/40 tabular-nums">{PRODUCTS.length}</span>
      </Link>

      <ul className="mt-1">
        {CATEGORY_GROUPS.map((g) => {
          const isOpen = open.has(g.slug);
          const isActiveGroup = activeSlug === g.slug;
          const groupCount = countForCategory(g.slug);
          return (
            <li key={g.slug} className="border-b border-border/50">
              <div className="flex items-stretch">
                <Link
                  to="/shop"
                  search={{ category: g.slug }}
                  className={`flex-1 py-2.5 pr-2 text-left ${
                    isActiveGroup
                      ? "text-foreground font-medium"
                      : "text-foreground/80 hover:text-foreground"
                  }`}
                >
                  {g.label}
                  <span className="ml-2 text-foreground/40 tabular-nums text-xs">
                    {groupCount}
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={isOpen ? `Collapse ${g.label}` : `Expand ${g.label}`}
                  aria-expanded={isOpen}
                  onClick={() => toggle(g.slug)}
                  className="px-2 text-foreground/50 hover:text-foreground"
                >
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </div>

              {isOpen && (
                <ul className="pb-3 pl-3 space-y-1.5">
                  {g.children.map((leafSlug) => {
                    const leaf = CATEGORIES.find((c) => c.slug === leafSlug);
                    if (!leaf) return null;
                    const isActive = activeSlug === leafSlug;
                    return (
                      <li key={leafSlug}>
                        <Link
                          to="/shop"
                          search={{ category: leafSlug }}
                          className={`block py-1 text-[13px] border-l pl-3 ${
                            isActive
                              ? "border-foreground text-foreground font-medium"
                              : "border-border/40 text-foreground/65 hover:text-foreground hover:border-foreground/60"
                          }`}
                        >
                          {leaf.label}
                          <span className="ml-2 text-foreground/40 tabular-nums text-xs">
                            {leaf.count}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}

        {/* Ungrouped leaf categories (e.g. pos-only) */}
        {UNGROUPED_CATEGORIES.map((c) => {
          const isActive = activeSlug === c.slug;
          return (
            <li key={c.slug} className="border-b border-border/50">
              <Link
                to="/shop"
                search={{ category: c.slug }}
                className={`block py-2.5 ${
                  isActive
                    ? "text-foreground font-medium"
                    : "text-foreground/80 hover:text-foreground"
                }`}
              >
                {c.label}
                <span className="ml-2 text-foreground/40 tabular-nums text-xs">{c.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Find the parent group that contains a given leaf slug.
function findParentGroup(leafSlug: string): CategoryGroup | undefined {
  return CATEGORY_GROUPS.find((g) => g.children.includes(leafSlug));
}

function CategoryBreadcrumbs({ activeSlug }: { activeSlug?: string }) {
  const group = activeSlug ? findParentGroup(activeSlug) : undefined;
  const label = activeSlug ? getCategoryLabel(activeSlug) : undefined;

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-xs text-muted-foreground">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        {activeSlug ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/shop">Shop</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>

            {group && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/shop" search={{ category: group.slug }}>
                      {group.label}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}

            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-foreground/80">{label}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage className="text-foreground/80">Shop</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
