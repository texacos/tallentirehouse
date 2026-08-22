import { createFileRoute, Link } from "@tanstack/react-router";
import heroInterior from "@/assets/hero-interior.jpg.asset.json";

const SITE = "https://tallentirehouse.lovable.app";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Our story — Tallentire House" },
      {
        name: "description",
        content:
          "From a first visit to Kutch in 1997 to workshops in India and Sri Lanka: the story of Tallentire House, designing through making with weavers, printers, dyers and embroiderers.",
      },
      { property: "og:title", content: "Our story — Tallentire House" },
      {
        property: "og:description",
        content:
          "Nearly thirty years of designing through making — handwoven, block-printed and hand-embroidered pieces created with craftspeople in India and Sri Lanka.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `${SITE}/about` },
      { property: "og:image", content: `${SITE}${heroInterior.url}` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE}${heroInterior.url}` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/about` }],
  }),
  component: About,
});

/** Placeholder image slot — replaced with real CDN assets once photos are uploaded. */
function StoryFigure({
  caption,
  ratio = "aspect-[3/2]",
  className = "",
}: {
  caption?: string;
  ratio?: string;
  className?: string;
}) {
  return (
    <figure className={className}>
      <div
        className={`${ratio} w-full bg-muted/60 border border-border flex items-center justify-center`}
      >
        <span className="eyebrow text-foreground/30">Image</span>
      </div>
      {caption ? (
        <figcaption className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="my-12 border-l-2 border-clay pl-6 font-display text-2xl md:text-3xl leading-snug text-clay">
      {children}
    </blockquote>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-14 lg:py-20">
      <p className="eyebrow text-foreground/60 mb-6">{label}</p>
      <div className="space-y-6 text-base leading-relaxed text-foreground/85">
        {children}
      </div>
    </section>
  );
}

function About() {
  return (
    <div>
      <section className="mx-auto max-w-3xl px-6 pt-20 lg:pt-28 pb-10 text-center">
        <p className="eyebrow text-foreground/60">Our story</p>
        <h1 className="mt-5 font-display text-5xl md:text-7xl leading-[0.95]">
          A small studio, in love with <em className="text-clay">slow things.</em>
        </h1>
      </section>

      {/* 1. Opening image */}
      <section className="mx-auto max-w-5xl px-6 pb-4">
        <StoryFigure caption="Kutch, one of the early visits." ratio="aspect-[3/2]" />
        <div className="mx-auto max-w-3xl">
          <PullQuote>
            Colour, cloth, craftsmanship — and the people you meet along the way.
          </PullQuote>
        </div>
      </section>

      {/* 2. It began in Kutch */}
      <Section label="It began in Kutch">
        <p>
          My first visit to Kutch was in 1997, with my mother and my sister Fiona. Mum had read
          an article describing Kutch as a textile mecca and, wanting to return to India with us,
          offered to take us. Naturally, we said yes.
        </p>
        <p>
          I had trained in textile design and weaving at Chelsea School of Art, but nothing had
          prepared me for the richness of what I found there — weaving, block printing, dyeing and
          embroidery, each rooted in different villages and family workshops, and an extraordinary
          depth of knowledge held by the people making them.
        </p>
        <StoryFigure caption="My first visit to Kutch, 1997." className="py-4" />
        <p>
          I went back in 1998, this time staying for several months. By 1999 I was beginning to
          develop my first collection of samples. One visit had become the beginning of a way of
          working — and of relationships that have now lasted nearly thirty years.
        </p>
      </Section>

      <div className="mx-auto max-w-3xl px-6"><div className="rule" /></div>

      {/* 3. Learning through making */}
      <Section label="Learning through making">
        <p>
          I have always designed through making rather than starting with a completely fixed idea.
          Even at Chelsea I would print onto the warp before weaving, embroider into woven samples
          afterwards, or add elastic and overdye the cloth simply to see what happened.
        </p>
        <p>
          That instinctive way of working prepared me surprisingly well for India, where handmade
          processes do not always produce exactly what was planned — and are often better for it.
        </p>
        <p>
          I still like to be there when we are sampling. The blocks may already have been carved,
          but the layout and the way they are combined can change as we work. We might stop a dye
          process because we happen upon a beautiful colour two shades lighter than the one we
          intended. I arrive with drawings, colours and ideas, but I don't want every detail of the
          finished piece to be predetermined.
        </p>
        <PullQuote>For me, designing has always happened in the making.</PullQuote>
        <figure>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StoryFigure ratio="aspect-square" />
            <StoryFigure ratio="aspect-square" />
          </div>
          <figcaption className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Indigo, washing and dyeing: the process is part of the design.
          </figcaption>
        </figure>
      </Section>

      <div className="mx-auto max-w-3xl px-6"><div className="rule" /></div>

      {/* 4. Design through collaboration */}
      <Section label="Design through collaboration">
        <p>
          Nearly three decades of working directly with weavers, printers, dyers and embroiderers
          has given me a deep practical understanding of what each craft can do — and where its
          limitations lie. That knowledge is fundamental to the way I design.
        </p>
        <p>
          The exchange works both ways. I bring my training, my eye for colour, pattern and
          proportion, and an understanding of a wider market; the craftspeople bring an intimate
          knowledge of their materials and techniques, often built over generations. Particularly
          with the weavers, simplifying a design, changing scale or introducing a different palette
          can transform the feel of the work without losing the integrity of the craft.
        </p>
        <p>
          I hope that exchange has played a small part in the success of some of the people I have
          worked with, just as their knowledge has profoundly influenced my own work. The most
          interesting pieces are often the ones neither of us would have made alone.
        </p>
        <figure>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StoryFigure ratio="aspect-square" />
            <StoryFigure ratio="aspect-square" />
          </div>
          <figcaption className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Shamji Vankar weaving and checking one of Lindsay's bedspread designs in Bhujodi, Kutch.
          </figcaption>
        </figure>
      </Section>

      <div className="mx-auto max-w-3xl px-6"><div className="rule" /></div>

      {/* 5. From loom to finished piece */}
      <Section label="From loom to finished piece">
        <StoryFigure caption="The finished handwoven bedspread in Sri Lanka." />
        <PullQuote>Traditional skill does not have to mean traditional design.</PullQuote>
        <p>
          The relationships matter as much as the techniques. I have worked with some families
          since they were young men beginning their careers; today they run successful workshops of
          their own. That history creates trust, shorthand and the freedom to experiment — a very
          different relationship from simply commissioning a finished product.
        </p>
      </Section>

      <div className="mx-auto max-w-3xl px-6"><div className="rule" /></div>

      {/* 6. A language of many crafts */}
      <Section label="A language of many crafts">
        <figure>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StoryFigure ratio="aspect-square" />
            <StoryFigure ratio="aspect-square" />
          </div>
          <figcaption className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Hand embroidery in progress, and a finished Tallentire House design.
          </figcaption>
        </figure>
        <p>
          Weaving, printing, dyeing and embroidery are not separate worlds to me. Years of working
          across them means I can think about how one technique might sit beside another, when to
          simplify, when to push an idea further and when the craft itself should lead.
        </p>
        <p>
          This is why the work is not simply a collection of beautiful handmade things. The designs
          grow from an understanding of the processes and from long-standing creative relationships
          with the people who practise them.
        </p>
      </Section>

      <div className="mx-auto max-w-3xl px-6"><div className="rule" /></div>

      {/* 7. The clothing */}
      <Section label="The clothing">
        <StoryFigure caption="Lindsay and Fiona Taylor wearing handwoven cloth developed with the weavers of Kutch." />
        <p>
          Fiona and I have worked creatively together for most of our adult lives, so collaborating
          on the clothing feels very natural. We have different but complementary instincts: my
          background is in textiles and surface design, while Fiona has a particularly strong eye
          for clothing, shape and styling.
        </p>
        <p>
          Fiona tends to develop the shapes and silhouettes, and together we choose the cloth —
          sometimes from fabrics we already love, sometimes using my block prints or handwoven
          textiles developed with our makers. Through Tallentire-Taylored Living, our clothing
          follows the same approach as everything else we make: beautiful cloth, simple enduring
          shapes and pieces designed to be worn for years rather than a season.
        </p>
      </Section>

      <div className="mx-auto max-w-3xl px-6"><div className="rule" /></div>

      {/* 8. Tallentire House today */}
      <Section label="Tallentire House today">
        <p>
          Tallentire House began in Sri Lanka, but its roots reach back through all those years of
          making, experimenting and learning. Today we work with craftspeople in India and Sri
          Lanka to create textiles, clothing and objects for the home, slowly and in relatively
          small quantities.
        </p>
        <p>
          We return to shapes and designs that work rather than replacing them simply because
          another season has arrived. Knowing where something is made, how it is made and who made
          it matters to us — as does making something beautiful enough to keep.
        </p>
        <PullQuote>Buy less, buy better.</PullQuote>
        <div className="text-center pt-4">
          <Link
            to="/shop"
            className="inline-flex items-center bg-foreground text-background px-8 py-4 text-xs uppercase tracking-[0.22em] hover:bg-foreground/85 transition"
          >
            Shop the collection
          </Link>
        </div>
      </Section>
    </div>
  );
}
