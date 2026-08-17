import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Minus, Plus, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import {
  formatPrice,
  getCategory,
  isVariable,
  displayPrice,
  isOutOfStock,
  type Product,
} from "@/lib/products";
import { productsQueryOptions, useProduct, useProducts } from "@/lib/products-store";
import { useCart } from "@/lib/cart";
import { ProductCard } from "@/components/site/ProductCard";
import { submitRestockRequest } from "@/lib/restock.functions";
import { useSiteSettings } from "@/lib/site-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductImage } from "@/components/site/ProductImage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/product/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Tallentire House` },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQueryOptions),
  component: ProductPage,
});

const emailSchema = z.string().trim().toLowerCase().email();

function ProductPage() {
  const { slug } = Route.useParams();
  const allProducts = useProducts();
  const product = useProduct(slug);
  const { productShippingNote: shippingNote } = useSiteSettings();


  const { add, openDrawer } = useCart();
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const variable = product ? isVariable(product) : false;
  const [selectedSize, setSelectedSize] = useState<string | undefined>(
    product && variable ? product.variants[0].size : undefined,
  );

  const activeVariant = useMemo(() => {
    if (!product || !variable || !selectedSize) return undefined;
    return product.variants.find((v) => v.size === selectedSize);
  }, [product, variable, selectedSize]);

  const [email, setEmail] = useState("");
  const [submittingRestock, setSubmittingRestock] = useState(false);
  const [restockSent, setRestockSent] = useState(false);

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-32 text-center">
        <p className="eyebrow text-foreground/60">404</p>
        <h1 className="mt-4 font-display text-4xl">We can't find that piece</h1>
        <Link to="/shop" className="mt-6 inline-block eyebrow border-b border-foreground pb-0.5">Back to the shop</Link>
      </div>
    );
  }

  const primaryCategorySlug = product.categories[0];
  const primaryCategory = primaryCategorySlug ? getCategory(primaryCategorySlug) : undefined;

  const related = allProducts.filter(
    (p) => p.slug !== product.slug && p.categories.some((c) => product.categories.includes(c)),
  ).slice(0, 4);

  const unitPrice = activeVariant?.price ?? (variable ? displayPrice(product) : product.price);

  // Stock resolution
  const productOutOfStock = isOutOfStock(product);
  const currentStock = variable
    ? (activeVariant?.stock ?? 0)
    : product.stock ?? 0;
  const variantOutOfStock = variable && !!activeVariant && (activeVariant.stock ?? 0) <= 0;
  const canAdd =
    !productOutOfStock &&
    (!variable || (!!activeVariant && !variantOutOfStock));

  const handleAdd = () => {
    if (!canAdd) return;
    if (variable && !selectedSize) return;
    const cappedQty = Math.min(qty, currentStock || qty);
    add(product.slug, cappedQty, selectedSize);
    openDrawer();
  };

  async function onRestockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSubmittingRestock(true);
    try {
      await submitRestockRequest({
        data: {
          productSlug: product.slug,
          productName: product.name,
          email: parsed.data,
        },
      });
      setRestockSent(true);
      setEmail("");
      toast.success("Thank you — we'll be in touch");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmittingRestock(false);
    }
  }

  return (
    <div>
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-4 text-[11px] uppercase tracking-[0.22em] text-foreground/60">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/shop" className="hover:text-foreground">Shop</Link>
          {primaryCategory && (
            <>
              <span className="mx-2">/</span>
              <Link to="/shop" search={{ category: primaryCategory.slug }} className="hover:text-foreground">{primaryCategory.label}</Link>
            </>
          )}
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-6 lg:px-10 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Images */}
          <div>
            <div className="relative bg-muted aspect-square overflow-hidden">
              <ProductImage
                src={product.images[activeImg]}
                alt={product.name}
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className={`h-full w-full object-cover ${productOutOfStock ? "opacity-80" : ""}`}
              />
              {productOutOfStock && (
                <span className="absolute top-4 left-4 bg-background/95 text-foreground text-[11px] uppercase tracking-[0.22em] px-3 py-1.5 border border-border">
                  Out of stock
                </span>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {product.images.map((src: string, i: number) => (
                  <button
                    key={src}
                    onClick={() => setActiveImg(i)}
                    className={`aspect-square overflow-hidden border ${i === activeImg ? "border-foreground" : "border-transparent opacity-70 hover:opacity-100"}`}
                  >
                    <ProductImage
                      src={src}
                      alt=""
                      sizes="120px"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="lg:py-6">
            {primaryCategory && <p className="eyebrow text-foreground/60">{primaryCategory.label}</p>}
            <h1 className="mt-4 font-display text-4xl md:text-5xl leading-[1.05]">{product.name}</h1>
            <div className="mt-5 text-xl tabular-nums">
              {variable && (
                <span className="text-xs uppercase tracking-[0.18em] mr-2 text-foreground/60">from</span>
              )}
              {formatPrice(variable ? displayPrice(product) : product.price)}
            </div>
            {!variable && product.sku && (
              <p className="mt-2 text-xs text-muted-foreground">SKU: {product.sku}</p>
            )}

            {/* Stock indicator (simple products only) */}
            {!variable && (
              <div className="mt-3 text-xs uppercase tracking-[0.18em]">
                {productOutOfStock ? (
                  <span className="text-destructive">Out of stock</span>
                ) : (
                  <span className="text-foreground/70">{currentStock} in stock</span>
                )}
              </div>
            )}


            <div className="my-8 rule" />

            <ProductInfoTabs product={product} />

            {variable && (
              <div className="mt-8">
                <p className="eyebrow text-foreground/60 mb-3">Size</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const active = selectedSize === v.size;
                    const vOOS = (v.stock ?? 0) <= 0;
                    return (
                      <button
                        key={v.size}
                        onClick={() => setSelectedSize(v.size)}
                        aria-pressed={active}
                        className={`px-4 py-2 text-xs border transition ${
                          active
                            ? "bg-foreground text-background border-foreground"
                            : "border-border hover:border-foreground"
                        } ${vOOS ? "opacity-60" : ""}`}
                      >
                        <span className="font-medium">{v.size}</span>
                        <span className="ml-2 text-[10px] opacity-70">
                          {vOOS ? "· out" : `· ${v.stock} left`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add to cart OR restock form */}
            {canAdd ? (
              <>
                <div className="mt-10 flex items-stretch gap-3">
                  <div className="inline-flex items-center border border-foreground">
                    <button
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="px-3 py-3"
                      aria-label="Decrease"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-10 text-center text-sm tabular-nums">{qty}</span>
                    <button
                      onClick={() =>
                        setQty((q) => Math.min(currentStock || q + 1, q + 1))
                      }
                      className="px-3 py-3"
                      aria-label="Increase"
                      disabled={qty >= currentStock}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    onClick={handleAdd}
                    disabled={variable && !selectedSize}
                    className="flex-1 bg-foreground text-background px-6 py-4 text-xs uppercase tracking-[0.22em] hover:bg-foreground/85 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {variable && !selectedSize
                      ? "Choose a size"
                      : `Add to basket — ${formatPrice(unitPrice * qty)}`}
                  </button>
                </div>
                {shippingNote ? (
                  <p className="mt-5 text-xs text-muted-foreground whitespace-pre-line">
                    {shippingNote}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="mt-10 border border-border p-6 bg-muted/30">
                {restockSent ? (
                  <>
                    <h2 className="font-display text-xl">Thank you</h2>
                    <p className="mt-2 text-sm text-foreground/80">
                      We've received your request and will get back to you as soon
                      as this piece is available again.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-foreground/85">
                      This product is currently out of stock. If you want us to make
                      it again for you, please submit your email address below and
                      we'll get back to you.
                    </p>
                    <form
                      onSubmit={onRestockSubmit}
                      className="mt-4 flex flex-col sm:flex-row gap-2"
                    >
                      <Input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        maxLength={320}
                        className="flex-1"
                      />
                      <Button type="submit" disabled={submittingRestock}>
                        {submittingRestock ? (
                          <>
                            <Loader2 className="animate-spin" /> Sending…
                          </>
                        ) : (
                          "Submit"
                        )}
                      </Button>
                    </form>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 lg:px-10 pb-24">
          <h2 className="font-display text-3xl mb-10">You may also love</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
