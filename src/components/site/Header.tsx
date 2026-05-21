import { Link } from "@tanstack/react-router";
import { ShoppingBag, Menu, X, ChevronDown, User } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, CATEGORY_GROUPS } from "@/lib/products";

const GROUPED_LEAVES = new Set(CATEGORY_GROUPS.flatMap((g) => g.children));
const UNGROUPED = CATEGORIES.filter((c) => !GROUPED_LEAVES.has(c.slug));

export function Header() {
  const { count, openDrawer } = useCart();
  const { user, isAdmin } = useAuth();
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
          {isAdmin && (
            <Link to="/admin/products" className="hover:text-foreground transition-colors text-foreground/50">Admin</Link>
          )}
        </nav>


        <Link to="/" className="flex items-baseline gap-3 select-none">
          <span className="font-display text-3xl md:text-4xl tracking-tight text-nowrap">Tallentire House</span>
          <span className="hidden lg:inline eyebrow text-foreground/60">Fabrics for life</span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            to={user ? "/account" : "/login"}
            aria-label={user ? "Account" : "Sign in"}
            className="p-2 text-foreground hover:opacity-70 transition"
          >
            <User size={20} strokeWidth={1.5} />
          </Link>
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

      {/* Secondary nav (top-level groups) */}
      <div className="hidden lg:block border-t border-border/40">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-8 px-10 py-3 text-[11px] uppercase tracking-[0.22em] text-foreground/70">
          {navGroups.map((g) => (
            <Link
              key={g.slug}
              to="/shop"
              search={{ category: g.slug }}
              className="hover:text-foreground transition-colors"
            >
              {g.label}
            </Link>
          ))}
          <Link to="/shop" className="hover:text-foreground transition-colors font-medium">
            All →
          </Link>
        </div>
      </div>

      {/* Mobile menu — expandable hierarchy */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-border/40 bg-background max-h-[80vh] overflow-y-auto">
          <div className="flex flex-col px-6 py-4 text-sm">
            <Link
              to="/shop"
              onClick={() => setMobileOpen(false)}
              className="py-2.5 uppercase tracking-[0.18em] border-b border-border/50"
            >
              Shop all
            </Link>

            {CATEGORY_GROUPS.map((g) => {
              const isOpen = openGroups.has(g.slug);
              return (
                <div key={g.slug} className="border-b border-border/50">
                  <div className="flex items-stretch">
                    <Link
                      to="/shop"
                      search={{ category: g.slug }}
                      onClick={() => setMobileOpen(false)}
                      className="flex-1 py-2.5 uppercase tracking-[0.18em] text-foreground/85"
                    >
                      {g.label}
                    </Link>
                    <button
                      type="button"
                      aria-label={isOpen ? `Collapse ${g.label}` : `Expand ${g.label}`}
                      aria-expanded={isOpen}
                      onClick={() => toggleGroup(g.slug)}
                      className="px-3 text-foreground/50 hover:text-foreground"
                    >
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                  {isOpen && (
                    <ul className="pb-3 pl-3 space-y-1">
                      {g.children.map((leafSlug) => {
                        const leaf = CATEGORIES.find((c) => c.slug === leafSlug);
                        if (!leaf) return null;
                        return (
                          <li key={leafSlug}>
                            <Link
                              to="/shop"
                              search={{ category: leafSlug }}
                              onClick={() => setMobileOpen(false)}
                              className="block py-1.5 text-[13px] text-foreground/70 border-l border-border/40 pl-3"
                            >
                              {leaf.label}
                              <span className="ml-2 text-foreground/40 tabular-nums text-xs">
                                {leaf.count}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}

            {UNGROUPED.map((c) => (
              <Link
                key={c.slug}
                to="/shop"
                search={{ category: c.slug }}
                onClick={() => setMobileOpen(false)}
                className="py-2.5 uppercase tracking-[0.18em] text-foreground/85 border-b border-border/50"
              >
                {c.label}
              </Link>
            ))}

            <Link
              to="/about"
              onClick={() => setMobileOpen(false)}
              className="py-2.5 mt-2 uppercase tracking-[0.18em]"
            >
              Our Story
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
