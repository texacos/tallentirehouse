import { createFileRoute, Link } from "@tanstack/react-router";
import heroInterior from "@/assets/hero-interior.jpg.asset.json";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Our story — Tallentire House" },
      { name: "description", content: "Tallentire House is a sustainable luxury homeware brand commissioning slow-craft pieces from small workshops around the world." },
      { property: "og:title", content: "Our story — Tallentire House" },
      { property: "og:description", content: "Slow-craft homewares, made with the workshops we love." },
      { property: "og:image", content: heroInterior.url },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div>
      <section className="mx-auto max-w-3xl px-6 pt-20 lg:pt-28 pb-8 text-center">
        <p className="eyebrow text-foreground/60">Our story</p>
        <h1 className="mt-5 font-display text-5xl md:text-7xl leading-[0.95]">
          A small studio, in love with <em className="text-clay">slow things.</em>
        </h1>
        <p className="mt-8 text-base text-muted-foreground leading-relaxed">
          Tallentire House grew from a lifelong love of textiles, colour and craftsmanship and more than 25 years of working closely with skilled artisans in India and Sri Lanka.
        </p>
        <p className="mt-8 text-base text-muted-foreground leading-relaxed">
          Everything begins with the design, not the finished product. A colour, a pattern, a cloth or a traditional technique becomes the starting point for a process of experimentation and collaboration between Lindsay and the craftspeople she works with.
        </p>
      </section>

      <section className="border-y border-border">
        <img
          src={heroInterior.url}
          alt="Tallentire House interior"
          width={1600}
          height={1100}
          loading="lazy"
          className="w-full h-[70vh] object-cover"
        />
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
        <div className="space-y-10 text-base leading-relaxed text-foreground/85">
          <div>
            <p className="eyebrow text-foreground/60 mb-3">Our mission</p>
            <p>
              We commission and curate sustainable homewares — fabrics, ceramics, lounging,
              travel pieces — from small workshops we've worked with for years. Each piece
              is paid for fairly, made without rush, and built to be passed on, not replaced.
            </p>
          </div>
          <div>
            <p className="eyebrow text-foreground/60 mb-3">Slow by design</p>
            <p>
              Our collections move in seasons, not weeks. When a piece sells out, it's gone
              until the workshop has time to make more. This is the only way we know how
              to work — and the only way that lets the people who make our pieces work
              the way they want to.
            </p>
          </div>
          <div>
            <p className="eyebrow text-foreground/60 mb-3">Where we make</p>
            <p>
              From block-printers in Bagru and Jaipur, to handloom weavers in Tamil Nadu,
              to potters in Jingdezhen — every piece carries the fingerprint of the maker
              and a quiet variation no machine can give it.
            </p>
          </div>
        </div>

        <div className="my-14 rule" />

        <div className="text-center">
          <Link
            to="/shop"
            className="inline-flex items-center bg-foreground text-background px-8 py-4 text-xs uppercase tracking-[0.22em] hover:bg-foreground/85 transition"
          >
            Shop the collection
          </Link>
        </div>
      </section>
    </div>
  );
}
