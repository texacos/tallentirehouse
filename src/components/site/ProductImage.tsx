import { responsiveSources } from "@/lib/product-images";

/**
 * Renders a product image with AVIF-free but WebP + JPEG responsive sources
 * when the image came from the managed pipeline; legacy URLs fall back to a
 * plain <img>.
 */
export function ProductImage({
  src,
  alt,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  className,
  priority = false,
  width = 1200,
  height = 1200,
}: {
  src: string;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}) {
  const sources = responsiveSources(src);
  const img = (
    <img
      src={sources?.src ?? src}
      alt={alt}
      width={width}
      height={height}
      sizes={sources ? sizes : undefined}
      srcSet={sources?.jpeg}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={className}
    />
  );
  if (!sources || !sources.webp) return img;
  return (
    <picture>
      <source type="image/webp" srcSet={sources.webp} sizes={sizes} />
      {img}
    </picture>
  );
}
