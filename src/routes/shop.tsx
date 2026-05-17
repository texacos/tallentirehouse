import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { CATEGORIES, PRODUCTS, getCategory } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";

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
      { name: "description", content: "Browse cushions, silk, ceramics, fabrics and homewares — each piece made by hand in small batches." },
      { property: "og:title", content: "Shop the collection — Tallentire House" },
    ],
  }),
  component: Shop,
});

function Shop() {
  const { category, page = 1 } = Route.useSearch();

  const filtered = useMemo(
    () => (category ? PRODUCTS.filter((p) => p.categories.includes(category)) : PRODUCTS),
    [category],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const items = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const heading = category ? getCategory(category)?.label ?? "Shop" : "The Collection";

  return (
    <div>
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-14 lg:py-20 text-center">
          <p className="eyebrow text-foreground/60">{category ? "Category" : `${PRODUCTS.length} pieces`}</p>
          <h1 className="mt-4 font-display text-5xl md:text-6xl">{heading}</h1>
          <p className="mx-auto mt-5 max-w-xl text-sm text-muted-foreground leading-relaxed">
            Every piece is made by hand in small batches in our workshops.
          </p>
        </div>
      </section>

      {/* Filters */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.2em]">
          <Link
            to="/shop"
            className={`pb-1 border-b ${!category ? "border-foreground text-foreground" : "border-transparent text-foreground/60 hover:text-foreground"}`}
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to="/shop"
              search={{ category: c.slug }}
              className={`pb-1 border-b ${category === c.slug ? "border-foreground text-foreground" : "border-transparent text-foreground/60 hover:text-foreground"}`}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid */}
      <section className="mx-auto max-w-7xl px-6 lg:px-10 py-14">
        {items.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-display text-2xl">Nothing here yet.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-14">
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
      </section>
    </div>
  );
}
