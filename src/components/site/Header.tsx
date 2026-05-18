import { Link } from "@tanstack/react-router";
import { ShoppingBag, Menu, X, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { CATEGORIES, CATEGORY_GROUPS } from "@/lib/products";

const GROUPED_LEAVES = new Set(CATEGORY_GROUPS.flatMap((g) => g.children));
const UNGROUPED = CATEGORIES.filter((c) => !GROUPED_LEAVES.has(c.slug));

export function Header() {
  const { count, openDrawer } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (slug: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  const navGroups = CATEGORY_GROUPS.slice(0, 7);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
        <button
          aria-label="Menu"
          className="lg:hidden -ml-2 p-2 text-foreground"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav className="hidden lg:flex items-center gap-8 text-[13px] uppercase tracking-[0.18em] text-foreground/80">
          <Link to="/shop" className="hover:text-foreground transition-colors">Shop all</Link>
          <Link to="/about" className="hover:text-foreground transition-colors">Our Story</Link>
        </nav>

        <Link to="/" className="flex items-baseline gap-3 select-none">
          <span className="font-display text-3xl md:text-4xl tracking-tight text-nowrap">Tallentire House</span>
          <span className="hidden lg:inline eyebrow text-foreground/60">Fabrics for life</span>
        </Link>

        <div className="flex items-center gap-1">
          <button
            onClick={openDrawer}
            aria-label="Open cart"
            className="relative p-2 text-foreground hover:opacity-70 transition"
          >
            <ShoppingBag size={20} strokeWidth={1.5} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-foreground">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Secondary nav (top categories) */}
      <div className="hidden lg:block border-t border-border/40">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-8 px-10 py-3 text-[11px] uppercase tracking-[0.22em] text-foreground/70">
          {navCategories.map((c) => (
            <Link
              key={c.slug}
              to="/shop"
              search={{ category: c.slug }}
              className="hover:text-foreground transition-colors"
            >
              {c.label}
            </Link>
          ))}
          <Link to="/shop" className="hover:text-foreground transition-colors font-medium">
            All →
          </Link>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-border/40 bg-background max-h-[70vh] overflow-y-auto">
          <div className="flex flex-col gap-1 px-6 py-4 text-sm uppercase tracking-[0.18em]">
            <Link to="/shop" onClick={() => setMobileOpen(false)} className="py-2">Shop all</Link>
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                to="/shop"
                search={{ category: c.slug }}
                onClick={() => setMobileOpen(false)}
                className="py-2 text-foreground/80"
              >
                {c.label}
              </Link>
            ))}
            <Link to="/about" onClick={() => setMobileOpen(false)} className="py-2">Our Story</Link>
          </div>
        </div>
      )}
    </header>
  );
}
