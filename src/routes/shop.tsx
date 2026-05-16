import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { CATEGORIES, PRODUCTS, type Category } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";

const searchSchema = z.object({
  category: z
    .enum(["cushions", "ceramics", "fabrics", "accessories", "lounging", "travel"])
    .optional(),
});

export const Route = createFileRoute("/shop")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Shop — Tallentire House" },
      { name: "description", content: "Browse cushions, ceramics, fabrics, and homewares — each piece commissioned from small workshops and made in small batches." },
      { property: "og:title", content: "Shop the collection — Tallentire House" },
    ],
  }),
  component: Shop,
});

function Shop() {
  const { category } = Route.useSearch();
  const filtered = category ? PRODUCTS.filter((p) => p.category === category) : PRODUCTS;
  const active: Category | undefined = category;
  const heading = active
    ? CATEGORIES.find((c) => c.slug === active)?.label ?? "Shop"
    : "The Collection";

  return (
    <div>
      {/* Page header */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-16 lg:py-24 text-center">
          <p className="eyebrow text-foreground/60">{active ? "Category" : "All pieces"}</p>
          <h1 className="mt-4 font-display text-5xl md:text-6xl">{heading}</h1>
          <p className="mx-auto mt-5 max-w-xl text-sm text-muted-foreground leading-relaxed">
            Every piece in the shop is made by hand in small batches. When something is gone,
            it's gone — until the next season's commission.
          </p>
        </div>
      </section>

      {/* Filters */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-5 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[12px] uppercase tracking-[0.22em]">
          <Link
            to="/shop"
            className={`pb-1 border-b ${!active ? "border-foreground text-foreground" : "border-transparent text-foreground/60 hover:text-foreground"}`}
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to="/shop"
              search={{ category: c.slug }}
              className={`pb-1 border-b ${active === c.slug ? "border-foreground text-foreground" : "border-transparent text-foreground/60 hover:text-foreground"}`}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid */}
      <section className="mx-auto max-w-7xl px-6 lg:px-10 py-16">
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-display text-2xl">Nothing here yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">New pieces arrive each season.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-14">
            {filtered.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
