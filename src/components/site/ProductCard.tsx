import { Link } from "@tanstack/react-router";
import { ProductImage } from "@/components/site/ProductImage";
import { formatPrice, isVariable, displayPrice, isOutOfStock, type Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const variable = isVariable(product);
  const shownPrice = displayPrice(product);
  const oos = isOutOfStock(product);
  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      className="group block"
    >
      <div className="relative overflow-hidden bg-muted aspect-square">
        <ProductImage
          src={product.images[0]}
          alt={product.name}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className={`h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04] ${oos ? "opacity-70" : ""}`}
        />
        {oos && (
          <span className="absolute top-3 left-3 bg-background/95 text-foreground text-[10px] uppercase tracking-[0.22em] px-2.5 py-1 border border-border">
            Out of stock
          </span>
        )}
      </div>
      <div className="mt-4 flex justify-between items-baseline gap-3">
        <h3 className="font-display text-lg leading-snug">{product.name}</h3>
        <span className="text-sm tabular-nums text-foreground/80 whitespace-nowrap">
          {variable && <span className="text-[10px] uppercase tracking-[0.18em] mr-1 text-foreground/50">from</span>}
          {formatPrice(shownPrice)}
        </span>
      </div>
    </Link>
  );
}
