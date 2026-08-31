import { Link } from "@tanstack/react-router";
import { Instagram } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-32 border-t border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-16 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2 max-w-md">
          <div className="font-display text-3xl">Tallentire House</div>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            A sustainable luxury textile & homeware brand. We commission slow-craft pieces from
            small workshops and bring them home to the people who will love them for years.
          </p>
        </div>

        <div>
          <div className="eyebrow text-foreground/70 mb-4">Shop</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/shop" className="hover:opacity-70">All pieces</Link></li>
            <li><Link to="/shop" search={{ category: "cushions" }} className="hover:opacity-70">Cushions</Link></li>
            <li><Link to="/shop" search={{ category: "ceramics-tableware" }} className="hover:opacity-70">Ceramics</Link></li>
            <li><Link to="/shop" search={{ category: "fabric-by-the-metre" }} className="hover:opacity-70">Fabrics</Link></li>
          </ul>
        </div>

        <div>
          <div className="eyebrow text-foreground/70 mb-4">About Us</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/about" className="hover:opacity-70">Our story</Link></li>
            <li><Link to="/contact" className="hover:opacity-70">Contact</Link></li>
            <li><Link to="/locations" className="hover:opacity-70">Locations</Link></li>
            <li>
              <a
                href="https://www.instagram.com/tallentirehouse/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:opacity-70"
                aria-label="Tallentire House on Instagram"
              >
                <Instagram size={18} />
                <span>Instagram</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-6 flex flex-col sm:flex-row justify-between gap-2 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} Tallentire House. All rights reserved.</div>
          <div>Made slowly, in small batches.</div>
        </div>
      </div>
    </footer>
  );
}
