import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PRODUCTS, type Product } from "./products";
import { useCustomProducts } from "./customProducts";

export type CartItem = { slug: string; qty: number };

type CartCtx = {
  items: CartItem[];
  detailed: Array<CartItem & { product: Product; lineTotal: number }>;
  count: number;
  subtotal: number;
  add: (slug: string, qty?: number) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  isOpen: boolean;
};

const Ctx = createContext<CartCtx | null>(null);
const STORAGE_KEY = "th_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const customProducts = useCustomProducts();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const value = useMemo<CartCtx>(() => {
    const detailed = items
      .map((i) => {
        const product =
          customProducts.find((p) => p.slug === i.slug) ??
          PRODUCTS.find((p) => p.slug === i.slug);
        if (!product) return null;
        return { ...i, product, lineTotal: product.price * i.qty };
      })
      .filter(Boolean) as CartCtx["detailed"];

    return {
      items,
      detailed,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: detailed.reduce((s, i) => s + i.lineTotal, 0),
      add: (slug, qty = 1) =>
        setItems((prev) => {
          const found = prev.find((i) => i.slug === slug);
          if (found) return prev.map((i) => (i.slug === slug ? { ...i, qty: i.qty + qty } : i));
          return [...prev, { slug, qty }];
        }),
      remove: (slug) => setItems((prev) => prev.filter((i) => i.slug !== slug)),
      setQty: (slug, qty) =>
        setItems((prev) =>
          qty <= 0
            ? prev.filter((i) => i.slug !== slug)
            : prev.map((i) => (i.slug === slug ? { ...i, qty } : i)),
        ),
      clear: () => setItems([]),
      openDrawer: () => setIsOpen(true),
      closeDrawer: () => setIsOpen(false),
      isOpen,
    };
  }, [items, isOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
