import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product, ProductVariant } from "./products";
import { useProductsOptional } from "./products-store";

export type CartItem = { slug: string; size?: string; qty: number };

export type DetailedCartItem = CartItem & {
  product: Product;
  variant?: ProductVariant;
  unitPrice: number;
  lineTotal: number;
};

type CartCtx = {
  items: CartItem[];
  detailed: DetailedCartItem[];
  count: number;
  subtotal: number;
  add: (slug: string, qty?: number, size?: string) => void;
  remove: (slug: string, size?: string) => void;
  setQty: (slug: string, qty: number, size?: string) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  isOpen: boolean;
};

const Ctx = createContext<CartCtx | null>(null);
const STORAGE_KEY = "th_cart_v2";

const sameLine = (a: CartItem, slug: string, size?: string) =>
  a.slug === slug && (a.size ?? "") === (size ?? "");

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const products = useProductsOptional();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const value = useMemo<CartCtx>(() => {
    const detailed = items
      .map((i) => {
        const product = products.find((p) => p.slug === i.slug);
        if (!product) return null;
        const variant = i.size
          ? product.variants.find((v) => v.size === i.size)
          : undefined;
        const unitPrice = variant?.price ?? product.price;
        return { ...i, product, variant, unitPrice, lineTotal: unitPrice * i.qty };
      })
      .filter(Boolean) as DetailedCartItem[];

    return {
      items,
      detailed,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: detailed.reduce((s, i) => s + i.lineTotal, 0),
      add: (slug, qty = 1, size) =>
        setItems((prev) => {
          const found = prev.find((i) => sameLine(i, slug, size));
          if (found)
            return prev.map((i) =>
              sameLine(i, slug, size) ? { ...i, qty: i.qty + qty } : i,
            );
          return [...prev, { slug, size, qty }];
        }),
      remove: (slug, size) =>
        setItems((prev) => prev.filter((i) => !sameLine(i, slug, size))),
      setQty: (slug, qty, size) =>
        setItems((prev) =>
          qty <= 0
            ? prev.filter((i) => !sameLine(i, slug, size))
            : prev.map((i) => (sameLine(i, slug, size) ? { ...i, qty } : i)),
        ),
      clear: () => setItems([]),
      openDrawer: () => setIsOpen(true),
      closeDrawer: () => setIsOpen(false),
      isOpen,
    };
  }, [items, isOpen, products]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
