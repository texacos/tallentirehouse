import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { searchProducts } from "@/lib/search.functions";
import { normaliseQuery, SEARCH_PAGE_SIZE, MAX_SEARCH_RESULTS } from "@/lib/search";
import { ProductCard } from "@/components/site/ProductCard";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  page: fallback(z.number().int(), 1).default(1),
});

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Search — Tallentire House" },
      {
        name: "description",
        content: "Search hand-blocked fabrics, cushions, bags and homewares from Tallentire House.",
      },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Search — Tallentire House" },
      { property: "og:description", content: "Find hand-made textiles and homewares in our collection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q, page } = Route.useSearch();
  const run = useServerFn(searchProducts);
  const query = normaliseQuery(q);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", query],
    queryFn: () => run({ data: { q: query, limit: MAX_SEARCH_RESULTS } }),
    enabled: query.length >= 2,
    staleTime: 60_000,
  });

  const results = data?.results ?? [];
  const pageCount = Math.max(1, Math.ceil(results.length / SEARCH_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);
  const items = results.slice((current - 1) * SEARCH_PAGE_SIZE, current * SEARCH_PAGE_SIZE);

  return (
    <div>
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-14 lg:py-20 text-center">
          <p className="eyebrow text-foreground/60">Search results for</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl break-words">
            {query ? `“${query}”` : "Search"}
          </h1>
          {query.length >= 2 && !isFetching && !isError && (
            <p className="mt-5 text-sm text-muted-foreground">
              {results.length} {results.length === 1 ? "product" : "products"} found
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 lg:px-10 py-10 lg:py-16">
        {query.length < 2 ? (
          <Empty
            title="Start a search"
            body="Type at least two characters in the search field to find products."
          />
        ) : isFetching ? (
          <div className="flex justify-center py-24 text-foreground/60" aria-live="polite">
            <Loader2 className="animate-spin" size={22} strokeWidth={1.5} />
            <span className="sr-only">Searching…</span>
          </div>
        ) : isError || data?.failed ? (
          <Empty
            title="Search is unavailable"
            body="Something went wrong on our side. Please try again in a moment."
          />
        ) : data?.limited ? (
          <Empty title="Too many searches" body="Please wait a moment before searching again." />
        ) : results.length === 0 ? (
          <Empty
            title="No products found"
            body="Try a different word, a colour or a category — or browse the full collection."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-14">
              {items.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
            {pageCount > 1 && (
              <div className="mt-16 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.2em]">
                {current > 1 && (
                  <Link
                    to="/search"
                    search={{ q: query, page: current - 1 }}
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
                    to="/search"
                    search={{ q: query, page: current + 1 }}
                    className="border border-foreground/30 px-4 py-2 hover:border-foreground"
                  >
                    Next
                  </Link>
                )}
              </div>
            )}
            <div className="mt-14 flex justify-center">
              <Link
                to="/shop"
                className="border border-foreground px-6 py-3 text-xs uppercase tracking-[0.22em] hover:bg-foreground hover:text-background transition"
              >
                Back to the shop
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center" aria-live="polite">
      <p className="font-display text-3xl">{title}</p>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{body}</p>
      <Link
        to="/shop"
        className="mt-8 inline-block border border-foreground px-6 py-3 text-xs uppercase tracking-[0.22em] hover:bg-foreground hover:text-background transition"
      >
        Browse the collection
      </Link>
    </div>
  );
}
