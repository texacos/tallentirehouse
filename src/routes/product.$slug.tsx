import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { CATEGORIES, formatPrice, getProduct, PRODUCTS } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { ProductCard } from "@/components/site/ProductCard";

export const Route = createFileRoute("/product/$slug")({
  loader: ({ params }) => {
    const product = getProduct(params.slug);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.product.name} — Tallentire House` },
          { name: "description", content: loaderData.product.blurb },
          { property: "og:title", content: `${loaderData.product.name} — Tallentire House` },
          { property: "og:description", content: loaderData.product.blurb },
          { property: "og:image", content: loaderData.product.image },
          { name: "twitter:image", content: loaderData.product.image },
        ]
      : [],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-32 text-center">
      <p className="eyebrow text-foreground/60">404</p>
      <h1 className="mt-4 font-display text-4xl">We can't find that piece</h1>
      <Link to="/shop" className="mt-6 inline-block eyebrow border-b border-foreground pb-0.5">Back to the shop</Link>
    </div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const { add, openDrawer } = useCart();
  const [qty, setQty] = useState(1);
  const categoryLabel = CATEGORIES.find((c) => c.slug === product.category)?.label;
  const related = PRODUCTS.filter((p) => p.slug !== product.slug).slice(0, 4);

  const handleAdd = () => {
    add(product.slug, qty);
    openDrawer();
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-4 text-[11px] uppercase tracking-[0.22em] text-foreground/60">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/shop" className="hover:text-foreground">Shop</Link>
          <span className="mx-2">/</span>
          <Link to="/shop" search={{ category: product.category }} className="hover:text-foreground">{categoryLabel}</Link>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-6 lg:px-10 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Image */}
          <div className="bg-muted">
            <img
              src={product.image}
              alt={product.name}
              width={900}
              height={900}
              className="h-full w-full object-cover"
            />
          </div>

          {/* Details */}
          <div className="lg:py-6">
            <p className="eyebrow text-foreground/60">{categoryLabel}</p>
            <h1 className="mt-4 font-display text-5xl md:text-6xl leading-[0.95]">{product.name}</h1>
            <div className="mt-5 text-xl tabular-nums">{formatPrice(product.price)}</div>

            <p className="mt-8 text-base leading-relaxed text-foreground/85">{product.blurb}</p>

            <div className="my-8 rule" />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="eyebrow text-foreground/60 mb-1.5">Made in</p>
                <p>{product.origin}</p>
              </div>
              <div>
                <p className="eyebrow text-foreground/60 mb-1.5">Materials</p>
                <p>{product.materials}</p>
              </div>
            </div>

            <div className="my-8 rule" />

            <p className="text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>

            {/* Quantity + add */}
            <div className="mt-10 flex items-stretch gap-3">
              <div className="inline-flex items-center border border-foreground">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-3" aria-label="Decrease">
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center text-sm tabular-nums">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="px-3 py-3" aria-label="Increase">
                  <Plus size={14} />
                </button>
              </div>
              <button
                onClick={handleAdd}
                className="flex-1 bg-foreground text-background px-6 py-4 text-xs uppercase tracking-[0.22em] hover:bg-foreground/85 transition"
              >
                Add to basket — {formatPrice(product.price * qty)}
              </button>
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              Made to order. Ships within 2–3 weeks. Worldwide shipping calculated at checkout.
            </p>
          </div>
        </div>
      </section>

      {/* Related */}
      <section className="mx-auto max-w-7xl px-6 lg:px-10 pb-24">
        <h2 className="font-display text-3xl mb-10">You may also love</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
          {related.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
