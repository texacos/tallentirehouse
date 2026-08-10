import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_HERO_SETTINGS,
  MAX_SLIDES,
  fallbackSrc,
  srcSetOf,
  type HeroConfig,
  type HeroSlide,
  type HeroTransition,
} from "@/lib/hero";

const SIZES = "100vw";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

function SlideImage({
  slide,
  priority,
  render,
}: {
  slide: HeroSlide;
  priority: boolean;
  render: boolean;
}) {
  if (!render) return null;
  const webp = srcSetOf(slide, "image/webp");
  const jpeg = srcSetOf(slide, "image/jpeg");
  return (
    <picture>
      {webp && <source type="image/webp" srcSet={webp} sizes={SIZES} />}
      {jpeg && <source type="image/jpeg" srcSet={jpeg} sizes={SIZES} />}
      <img
        src={fallbackSrc(slide)}
        alt={slide.altText}
        width={slide.width}
        height={slide.height}
        loading={priority ? "eager" : "lazy"}
        // @ts-expect-error - fetchpriority is a valid DOM attribute
        fetchpriority={priority ? "high" : "low"}
        decoding={priority ? "sync" : "async"}
        draggable={false}
        className="h-full w-full object-cover"
      />
    </picture>
  );
}

export function HeroSlider({
  config,
  fallbackImage,
  fallbackAlt = "",
  className = "h-[60vh] lg:h-[90vh]",
}: {
  config: HeroConfig | undefined;
  fallbackImage: string;
  fallbackAlt?: string;
  className?: string;
}) {
  const settings = config?.settings ?? DEFAULT_HERO_SETTINGS;
  const slides = useMemo(() => {
    if (!config || !settings.enabled) return [] as HeroSlide[];
    return config.slides.filter((s) => s.isActive && s.variants.length > 0).slice(0, MAX_SLIDES);
  }, [config, settings.enabled]);

  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [ready, setReady] = useState<Set<number>>(() => new Set([0, 1]));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setReady((prev) => new Set([...prev, index, index + 1]));
  }, [index]);

  useEffect(() => {
    if (slides.length < 2) return;
    const current = slides[index];
    const seconds = current?.duration ?? settings.duration;
    timer.current = setTimeout(() => {
      setPrev(index);
      setIndex((i) => (i + 1) % slides.length);
    }, Math.max(2, seconds) * 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [index, slides, settings.duration]);

  if (slides.length === 0) {
    return (
      <div className={`relative w-full overflow-hidden bg-muted ${className}`}>
        <img
          src={fallbackImage}
          alt={fallbackAlt}
          width={1920}
          height={1080}
          // @ts-expect-error - fetchpriority is a valid DOM attribute
          fetchpriority="high"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const effective: HeroTransition = reduced ? "dissolve" : settings.transition;

  return (
    <div
      className={`relative w-full overflow-hidden bg-muted ${className}`}
      role={slides.length > 1 ? "region" : undefined}
      aria-roledescription={slides.length > 1 ? "carousel" : undefined}
      aria-label={slides.length > 1 ? "Hero images" : undefined}
    >
      {slides.map((slide, i) => {
        const active = i === index;
        const outgoing = !active && i === prev;
        const transition = (reduced ? "dissolve" : slide.transition ?? effective) as HeroTransition;
        const base =
          "absolute inset-0 will-change-[opacity,transform] transition-[opacity,transform] duration-[1600ms] ease-[cubic-bezier(0.45,0,0.25,1)]";
        // The outgoing slide stays fully opaque underneath while the incoming one
        // fades in on top — this avoids the brightness dip of a double cross-fade.
        const visible = active || outgoing;
        const state =
          transition === "slide"
            ? active
              ? "opacity-100 translate-x-0"
              : outgoing
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-[4%]"
            : visible
              ? "opacity-100"
              : "opacity-0";
        const layer = active ? "z-[2]" : outgoing ? "z-[1]" : "z-0";
        return (
          <div
            key={slide.id}
            className={`${base} ${state} ${layer} ${
              transition === "zoom" && visible && !reduced ? "hero-zoom" : ""
            }`}
            aria-hidden={!active}
          >
            <SlideImage slide={slide} priority={i === 0} render={ready.has(i)} />
          </div>
        );
      })}

      {slides.length > 1 && (
        <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show hero slide ${i + 1}${slide.title ? `: ${slide.title}` : ""}`}
              aria-current={i === index}
              className={`h-2 w-2 rounded-full border border-white/80 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                i === index ? "bg-white" : "bg-white/25 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
