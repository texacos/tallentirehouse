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
            <p className="eyebrow text-foreground/60 mb-3">Our approach</p>
            <p>
              Lindsay is a textile designer and weaver by training, with a particular instinct for colour, pattern and the possibilities of cloth. Working directly with weavers, printers and embroiderers, she combines her own designs and eye for colour with skills often passed down through generations. It is a genuinely collaborative process: designer and maker learning from one another, experimenting together and creating pieces that are truly individual.
            </p>
          </div>
          <div>
            <p className="eyebrow text-foreground/60 mb-3">Slow by design</p>
            <p>
              Our collections are made slowly, in small quantities and never driven by trends. The clothing collection, developed by Lindsay with her sister Fiona, follows the same philosophy. Rather than reinventing the collection each season, we return to favourite shapes — refining them and making them again in different fabrics, prints and colours. We believe in buying less, buying better, and making things that will be loved and worn for years.
            </p>
          </div>
          <div>
            <p className="eyebrow text-foreground/60 mb-3">Where we make</p>
            <p>
              Our collections are made across India and Sri Lanka, from family-run workshops and looms in the homes of artisans in the small villages of Kutch, to our own workshop in Sri Lanka. We work directly with the people who make our pieces, building relationships that in many cases go back decades. Knowing where something is made, how it is made and who made it is fundamental to Tallentire House.
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
