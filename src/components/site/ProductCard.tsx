import { Link } from "@tanstack/react-router";
import { formatPrice, isVariable, displayPrice, type Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const variable = isVariable(product);
  const shownPrice = displayPrice(product);
  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      className="group block"
    >
      <div className="overflow-hidden bg-muted aspect-square">
        <img
          src={product.images[0]}
          alt={product.name}
          width={900}
          height={900}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
        />
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
