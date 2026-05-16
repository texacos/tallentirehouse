import { createFileRoute, Link } from "@tanstack/react-router";
import { PRODUCTS, CATEGORIES } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";
import heroInterior from "@/assets/hero-interior.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tallentire House — Sustainable luxury homewares" },
      { name: "description", content: "Hand-blocked cushions, handwoven fabrics and slow-craft ceramics, commissioned from small workshops and made to last." },
      { property: "og:title", content: "Tallentire House — Sustainable luxury homewares" },
      { property: "og:description", content: "Slow-craft homewares from the workshops we love." },
      { property: "og:image", content: heroInterior },
      { name: "twitter:image", content: heroInterior },
    ],
  }),
  component: Index,
});

function Index() {
  const featured = PRODUCTS.slice(0, 4);

  return (
    <>
      {/* HERO */}
      <section className="relative">
        <div className="grid lg:grid-cols-12 gap-0 items-stretch">
          <div className="lg:col-span-5 flex items-center px-6 lg:px-14 py-16 lg:py-32 order-2 lg:order-1">
            <div className="max-w-md">
              <p className="eyebrow text-foreground/60">Spring collection · 2026</p>
              <h1 className="mt-5 font-display text-5xl md:text-6xl lg:text-7xl leading-[0.95]">
                Fabrics<br/>for a life<br/><em className="text-clay">slowly lived.</em>
              </h1>
              <p className="mt-6 text-base text-muted-foreground leading-relaxed">
                Hand-blocked cushions, handwoven throws and slow-craft ceramics —
                commissioned from the small workshops we've known for years and
                made for the homes that will love them for many more.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/shop"
                  className="inline-flex items-center bg-foreground text-background px-7 py-3.5 text-xs uppercase tracking-[0.22em] hover:bg-foreground/85 transition"
                >
                  Shop the collection
                </Link>
                <Link
                  to="/about"
                  className="inline-flex items-center px-1 py-3.5 text-xs uppercase tracking-[0.22em] border-b border-foreground hover:opacity-70"
                >
                  Our story
                </Link>
              </div>
            </div>
          </div>
          <div className="lg:col-span-7 order-1 lg:order-2">
            <img
              src={heroInterior}
              alt="Sustainable luxury bedroom with hand-blocked indigo cushions and antique carved bed"
              width={1600}
              height={1100}
              className="h-[60vh] lg:h-[90vh] w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* CATEGORIES STRIP */}
      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-y-6 gap-x-4 text-center">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to="/shop"
              search={{ category: c.slug }}
              className="group flex flex-col items-center gap-2 hover:text-clay transition-colors"
            >
              <span className="font-display text-2xl">{c.label.split(" ")[0]}</span>
              <span className="eyebrow text-foreground/60 group-hover:text-clay">
                Browse
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      <section className="mx-auto max-w-7xl px-6 lg:px-10 py-24">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="eyebrow text-foreground/60">New this season</p>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">Pieces we love right now</h2>
          </div>
          <Link to="/shop" className="hidden sm:inline-flex eyebrow border-b border-foreground pb-0.5">View all</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
          {featured.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      {/* STORY BAND */}
      <section className="bg-foreground text-background">
        <div className="mx-auto max-w-5xl px-6 lg:px-10 py-28 text-center">
          <p className="eyebrow text-background/60">A note from the studio</p>
          <p className="mt-6 font-display text-3xl md:text-4xl leading-[1.25] italic">
            "We don't believe in trends. We believe in pieces that find their way
            into the rhythm of a home and stay there — quietly, for many years."
          </p>
          <p className="mt-8 eyebrow text-background/60">— The Tallentire studio</p>
        </div>
      </section>

      {/* SECONDARY GRID */}
      <section className="mx-auto max-w-7xl px-6 lg:px-10 py-24">
        <div className="grid lg:grid-cols-2 gap-10">
          <Link to="/shop" search={{ category: "ceramics" }} className="group block">
            <div className="overflow-hidden bg-muted aspect-[4/5]">
              <img
                src={PRODUCTS[2].image}
                alt="Ceramics"
                width={1200} height={1500} loading="lazy"
                className="h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
              />
            </div>
            <div className="mt-6">
              <p className="eyebrow text-foreground/60">Ceramics</p>
              <h3 className="font-display text-3xl mt-2">Slow-thrown stoneware</h3>
            </div>
          </Link>
          <Link to="/shop" search={{ category: "lounging" }} className="group block">
            <div className="overflow-hidden bg-muted aspect-[4/5]">
              <img
                src={PRODUCTS[4].image}
                alt="Lounging"
                width={1200} height={1500} loading="lazy"
                className="h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
              />
            </div>
            <div className="mt-6">
              <p className="eyebrow text-foreground/60">Lounging</p>
              <h3 className="font-display text-3xl mt-2">For the long evenings</h3>
            </div>
          </Link>
        </div>
      </section>
    </>
  );
}
