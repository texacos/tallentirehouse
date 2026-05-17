import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/products";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your basket — Tallentire House" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { detailed, subtotal, setQty, remove, count } = useCart();
  const [placed, setPlaced] = useState(false);
  const shipping = subtotal > 0 ? (subtotal > 250 ? 0 : 18) : 0;
  const total = subtotal + shipping;

  if (placed) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-32 text-center">
        <p className="eyebrow text-foreground/60">Thank you</p>
        <h1 className="mt-4 font-display text-5xl">Your order is on its way</h1>
        <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
          This is a preview checkout — connect Stripe to take live payments. We'll
          show you the exact flow once you're ready.
        </p>
        <Link to="/shop" className="mt-8 inline-block bg-foreground text-background px-8 py-4 text-xs uppercase tracking-[0.22em]">
          Continue shopping
        </Link>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-32 text-center">
        <p className="eyebrow text-foreground/60">Your basket</p>
        <h1 className="mt-4 font-display text-5xl">Nothing here yet</h1>
        <p className="mt-5 text-sm text-muted-foreground">
          Begin by browsing the collection.
        </p>
        <Link to="/shop" className="mt-8 inline-block border border-foreground px-8 py-4 text-xs uppercase tracking-[0.22em] hover:bg-foreground hover:text-background transition">
          Shop the collection
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 lg:px-10 py-16">
      <div className="text-center mb-12">
        <p className="eyebrow text-foreground/60">Checkout</p>
        <h1 className="mt-3 font-display text-5xl">Your basket</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-12 lg:gap-16">
        {/* Items */}
        <div className="lg:col-span-2">
          <ul className="divide-y divide-border border-t border-b border-border">
            {detailed.map(({ product, qty, lineTotal }) => (
              <li key={product.slug} className="flex gap-5 py-6">
                <Link to="/product/$slug" params={{ slug: product.slug }} className="shrink-0">
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    width={140}
                    height={140}
                    loading="lazy"
                    className="h-32 w-32 sm:h-36 sm:w-36 object-cover bg-muted"
                  />
                </Link>
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <Link
                        to="/product/$slug"
                        params={{ slug: product.slug }}
                        className="font-display text-2xl leading-tight hover:opacity-70"
                      >
                        {product.name}
                      </Link>
                      {product.sku && <p className="text-xs text-muted-foreground mt-1 uppercase tracking-[0.18em]">SKU: {product.sku}</p>}
                    </div>
                    <button onClick={() => remove(product.slug)} aria-label="Remove" className="p-1 text-foreground/50 hover:text-foreground">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="mt-auto flex items-end justify-between pt-4">
                    <div className="inline-flex items-center border border-border">
                      <button onClick={() => setQty(product.slug, qty - 1)} className="p-2" aria-label="Decrease">
                        <Minus size={12} />
                      </button>
                      <span className="px-3 text-sm tabular-nums">{qty}</span>
                      <button onClick={() => setQty(product.slug, qty + 1)} className="p-2" aria-label="Increase">
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="tabular-nums">{formatPrice(lineTotal)}</div>
                      <div className="text-xs text-muted-foreground">{formatPrice(product.price)} each</div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-32 lg:self-start bg-secondary/50 p-8">
          <h2 className="font-display text-2xl mb-6">Order summary</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="tabular-nums">{shipping === 0 ? "Free" : formatPrice(shipping)}</dd>
            </div>
            {shipping > 0 && (
              <p className="text-xs text-muted-foreground">
                Add {formatPrice(250 - subtotal)} for complimentary shipping.
              </p>
            )}
          </dl>
          <div className="my-5 rule" />
          <div className="flex justify-between text-base">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(total)}</span>
          </div>

          <button
            onClick={() => setPlaced(true)}
            className="mt-6 w-full bg-foreground text-background py-4 text-xs uppercase tracking-[0.22em] hover:bg-foreground/85 transition"
          >
            Proceed to checkout
          </button>
          <p className="mt-3 text-xs text-muted-foreground text-center">
            Preview checkout. Stripe payments can be wired in next.
          </p>
        </aside>
      </div>
    </div>
  );
}
