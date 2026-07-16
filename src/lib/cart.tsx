import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { isVariable, type Product, type ProductVariant } from "./products";
import { useProductsOptional } from "./products-store";

export type CartItem = { slug: string; size?: string; qty: number };

export type DetailedCartItem = CartItem & {
  product: Product;
  variant?: ProductVariant;
  unitPrice: number;
  lineTotal: number;
  availableStock: number;
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

function stockFor(product: Product, size?: string): number {
  if (isVariable(product)) {
    if (!size) return 0;
    const v = product.variants.find((x) => x.size === size);
    return Math.max(0, v?.stock ?? 0);
  }
  return Math.max(0, product.stock ?? 0);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const products = useProductsOptional();
  const productsRef = useRef(products);
  productsRef.current = products;

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

  // Reconcile cart quantities when product stock changes (e.g. after refetch).
  useEffect(() => {
    if (!hydrated || products.length === 0) return;
    setItems((prev) => {
      let changed = false;
      const next: CartItem[] = [];
      for (const i of prev) {
        const p = products.find((x) => x.slug === i.slug);
        if (!p) {
          next.push(i);
          continue;
        }
        const stock = stockFor(p, i.size);
        if (stock <= 0) {
          changed = true;
          continue; // drop out-of-stock line
        }
        if (i.qty > stock) {
          changed = true;
          next.push({ ...i, qty: stock });
        } else {
          next.push(i);
        }
      }
      return changed ? next : prev;
    });
  }, [products, hydrated]);

  const value = useMemo<CartCtx>(() => {
    const detailed = items
      .map((i) => {
        const product = products.find((p) => p.slug === i.slug);
        if (!product) return null;
        const variant = i.size
          ? product.variants.find((v) => v.size === i.size)
          : undefined;
        const unitPrice = variant?.price ?? product.price;
        return {
          ...i,
          product,
          variant,
          unitPrice,
          lineTotal: unitPrice * i.qty,
          availableStock: stockFor(product, i.size),
        };
      })
      .filter(Boolean) as DetailedCartItem[];

    const add: CartCtx["add"] = (slug, qty = 1, size) => {
      const product = productsRef.current.find((p) => p.slug === slug);
      if (!product) return;
      const stock = stockFor(product, size);
      if (stock <= 0) {
        toast.error(`${product.name} is out of stock.`);
        return;
      }
      setItems((prev) => {
        const found = prev.find((i) => sameLine(i, slug, size));
        const current = found?.qty ?? 0;
        const desired = current + qty;
        const capped = Math.min(desired, stock);
        if (capped <= current) {
          toast.error(
            `Only ${stock} in stock${size ? ` for size ${size}` : ""}. You already have ${current} in your basket.`,
          );
          return prev;
        }
        if (capped < desired) {
          toast.warning(
            `Only ${stock} in stock${size ? ` for size ${size}` : ""}. Quantity set to the maximum available.`,
          );
        }
        if (found) {
          return prev.map((i) =>
            sameLine(i, slug, size) ? { ...i, qty: capped } : i,
          );
        }
        return [...prev, { slug, size, qty: capped }];
      });
    };

    const setQty: CartCtx["setQty"] = (slug, qty, size) => {
      if (qty <= 0) {
        setItems((prev) => prev.filter((i) => !sameLine(i, slug, size)));
        return;
      }
      const product = productsRef.current.find((p) => p.slug === slug);
      const stock = product ? stockFor(product, size) : qty;
      let capped = qty;
      if (stock <= 0) {
        toast.error(`This item is out of stock.`);
        setItems((prev) => prev.filter((i) => !sameLine(i, slug, size)));
        return;
      }
      if (qty > stock) {
        capped = stock;
        toast.warning(
          `Only ${stock} in stock${size ? ` for size ${size}` : ""}. Quantity set to the maximum available.`,
        );
      }
      setItems((prev) =>
        prev.map((i) => (sameLine(i, slug, size) ? { ...i, qty: capped } : i)),
      );
    };

    return {
      items,
      detailed,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: detailed.reduce((s, i) => s + i.lineTotal, 0),
      add,
      remove: (slug, size) =>
        setItems((prev) => prev.filter((i) => !sameLine(i, slug, size))),
      setQty,
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
