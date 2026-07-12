import { Link } from "@tanstack/react-router";
import { X, Minus, Plus } from "lucide-react";
import { useEffect } from "react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/products";

export function CartDrawer() {
  const { isOpen, closeDrawer, detailed, subtotal, setQty, remove } = useCart();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, closeDrawer]);

  return (
    <>
      <div
        onClick={closeDrawer}
        className={`fixed inset-0 z-50 bg-ink/40 transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 className="font-display text-2xl">Your basket</h2>
          <button onClick={closeDrawer} aria-label="Close cart" className="p-1">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {detailed.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="font-display text-xl">Your basket is empty</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Start by exploring the collection.
            </p>
            <Link
              to="/shop"
              onClick={closeDrawer}
              className="mt-6 inline-block border border-foreground px-6 py-3 text-xs uppercase tracking-[0.22em] hover:bg-foreground hover:text-background transition"
            >
              Shop the collection
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <ul className="divide-y divide-border">
                {detailed.map(({ product, qty, lineTotal, size, variant }) => (
                  <li key={product.slug + "::" + (size ?? "")} className="flex gap-4 py-5">
                    <Link to="/product/$slug" params={{ slug: product.slug }} onClick={closeDrawer} className="shrink-0">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        width={88}
                        height={88}
                        loading="lazy"
                        className="h-22 w-22 object-cover bg-muted"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-3">
                        <Link
                          to="/product/$slug"
                          params={{ slug: product.slug }}
                          onClick={closeDrawer}
                          className="font-display text-lg leading-tight hover:opacity-70"
                        >
                          {product.name}
                        </Link>
                        <div className="text-sm">{formatPrice(lineTotal)}</div>
                      </div>
                      {size && (
                        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-[0.16em]">Size: {size}</p>
                      )}
                      {(variant?.sku || product.sku) && (
                        <p className="text-xs text-muted-foreground mt-1">SKU: {variant?.sku || product.sku}</p>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="inline-flex items-center border border-border">
                          <button onClick={() => setQty(product.slug, qty - 1, size)} className="p-1.5" aria-label="Decrease">
                            <Minus size={12} />
                          </button>
                          <span className="px-3 text-sm tabular-nums">{qty}</span>
                          <button onClick={() => setQty(product.slug, qty + 1, size)} className="p-1.5" aria-label="Increase">
                            <Plus size={12} />
                          </button>
                        </div>
                        <button
                          onClick={() => remove(product.slug, size)}
                          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

            </div>

            <div className="border-t border-border px-6 py-5">
              <div className="flex justify-between mb-1 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Shipping and taxes calculated at checkout.
              </p>
              <Link
                to="/cart"
                onClick={closeDrawer}
                className="block w-full bg-foreground text-background text-center py-4 text-xs uppercase tracking-[0.22em] hover:bg-foreground/85 transition"
              >
                Checkout — {formatPrice(subtotal)}
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
