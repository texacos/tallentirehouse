import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/locations")({
  head: () => ({
    meta: [
      { title: "Locations — Tallentire House" },
      {
        name: "description",
        content:
          "Visit Tallentire House: our studio in Unawatuna and our shop at 10 Leyn Baan Street, Galle Fort, Sri Lanka.",
      },
      { property: "og:title", content: "Locations — Tallentire House" },
      {
        property: "og:description",
        content: "Our studio in Unawatuna and our shop in Galle Fort, Sri Lanka.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Locations,
});

type Place = {
  name: string;
  lines: string[];
  /** Exact search query Google resolves to the real place. */
  query: string;
  mapTitle: string;
};

const PLACES: Place[] = [
  {
    name: "The Studio",
    lines: ["Mihiripenna", "Meegahawaththa Rd,", "Unawatuna 80600", "Sri Lanka"],
    query: "Tallentire House, Meegahawaththa Rd, Mihiripenna, Unawatuna 80600, Sri Lanka",
    mapTitle: "Map showing the Tallentire House studio in Unawatuna, Sri Lanka",
  },
  {
    name: "The Shop",
    lines: ["10 Leyn Baan Street", "Galle Fort", "Galle 80000", "Sri Lanka"],
    query: "Tallentire House, 10 Leyn Baan Street, Galle Fort, Galle 80000, Sri Lanka",
    mapTitle: "Map showing the Tallentire House shop in Galle Fort, Sri Lanka",
  },
];

function mapEmbedSrc(p: Place) {
  // Keyless Google Maps embed — no API key is exposed to the browser.
  return `https://maps.google.com/maps?q=${encodeURIComponent(p.query)}&z=17&hl=en&output=embed`;
}

function mapLink(p: Place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.query)}`;
}


function Locations() {
  return (
    <div>
      <section className="mx-auto max-w-3xl px-6 py-20 lg:py-28 text-center">
        <p className="eyebrow text-foreground/60">Locations</p>
        <h1 className="mt-5 font-display text-5xl md:text-7xl leading-[0.95]">
          Come and see us in <em className="text-clay">Sri Lanka.</em>
        </h1>
        <p className="mt-8 text-base text-muted-foreground leading-relaxed">
          Our studio sits just inland from the sea at Unawatuna, and our shop is
          tucked into the old streets of Galle Fort. Visitors are always welcome.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="rule mb-14" />
        <div className="grid gap-16 md:grid-cols-2">
          {PLACES.map((p) => (
            <div key={p.name}>
              <h2 className="font-display text-3xl">{p.name}</h2>
              <address className="mt-4 not-italic text-sm text-muted-foreground leading-relaxed">
                {p.lines.map((l) => (
                  <div key={l}>{l}</div>
                ))}
              </address>

              <div className="mt-6 border border-border bg-secondary/30">
                <iframe
                  src={mapEmbedSrc(p)}
                  title={p.mapTitle}
                  loading="lazy"
                  referrerPolicy="origin-when-cross-origin"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  className="block h-[320px] w-full border-0"
                />
              </div>

              <a
                href={mapLink(p)}
                target="_blank"
                rel="noopener noreferrer external"
                className="mt-4 inline-block text-xs uppercase tracking-[0.22em] underline underline-offset-4 hover:opacity-70"
              >
                Open in Google Maps
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24 lg:pb-32">
        <div className="rule my-14" />
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="eyebrow text-foreground/60 mb-3">Contact us</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="tel:+94774327360" className="hover:opacity-70">
                  +94 &ndash; 77 432 7360
                </a>{" "}
                Lindsay
              </li>
              <li>
                <a href="tel:+94775869651" className="hover:opacity-70">
                  +94 &ndash; 77 586 9651
                </a>{" "}
                Manager
              </li>
              <li>
                <a href="mailto:info@tallentirehouse.com" className="hover:opacity-70">
                  info@tallentirehouse.com
                </a>
              </li>
            </ul>
          </div>
          <div className="md:text-right">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Prefer to write? Send us a message and we&rsquo;ll reply as soon as we can.
            </p>
            <Link
              to="/contact"
              className="mt-5 inline-block text-xs uppercase tracking-[0.22em] underline underline-offset-4 hover:opacity-70"
            >
              Go to contact form
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
