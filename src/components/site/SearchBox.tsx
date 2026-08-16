import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, X } from "lucide-react";
import { searchProducts } from "@/lib/search.functions";
import { normaliseQuery, MAX_QUERY_LENGTH } from "@/lib/search";
import { ProductImage } from "@/components/site/ProductImage";
import { formatPrice, displayPrice } from "@/lib/products";

const DEBOUNCE_MS = 250;
const SUGGESTION_COUNT = 5;

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function SearchBox() {
  const navigate = useNavigate();
  const search = useServerFn(searchProducts);
  const listId = useId();
  const [open, setOpen] = useState(false); // mobile panel
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const debounced = useDebounced(normaliseQuery(term), DEBOUNCE_MS);

  const { data, isFetching } = useQuery({
    queryKey: ["search-suggest", debounced],
    queryFn: () => search({ data: { q: debounced, limit: SUGGESTION_COUNT } }),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const suggestions = useMemo(() => data?.results?.slice(0, SUGGESTION_COUNT) ?? [], [data]);

  useEffect(() => {
    if (!showSuggestions) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showSuggestions]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    setShowSuggestions(false);
    setActive(-1);
    setOpen(false);
  };

  const submit = (q: string) => {
    const clean = normaliseQuery(q);
    if (!clean) {
      inputRef.current?.focus();
      return;
    }
    close();
    navigate({ to: "/search", search: { q: clean } });
  };

  const goToProduct = (slug: string) => {
    close();
    navigate({ to: "/product/$slug", params: { slug } });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (showSuggestions) setShowSuggestions(false);
      else close();
      return;
    }
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setShowSuggestions(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0 && showSuggestions) {
      e.preventDefault();
      goToProduct(suggestions[active]!.slug);
    }
  };

  const field = (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit(term);
      }}
      className="relative flex items-center"
    >
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search products
      </label>
      <input
        id={`${listId}-input`}
        ref={inputRef}
        type="search"
        value={term}
        maxLength={MAX_QUERY_LENGTH}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          setTerm(e.target.value);
          setActive(-1);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={onKeyDown}
        placeholder="Search products…"
        role="combobox"
        aria-expanded={showSuggestions && suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
        className="w-full border-b border-transparent bg-transparent py-1.5 pl-1 pr-8 text-[13px] tracking-[0.04em] text-foreground placeholder:text-foreground/40 outline-none transition-colors focus:border-border"
      />
      <button
        type="submit"
        aria-label="Search"
        className="absolute right-0 p-1 text-foreground hover:opacity-70 transition"
      >
        <Search size={18} strokeWidth={1.5} />
      </button>

      {showSuggestions && normaliseQuery(term).length >= 2 && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-2 border border-border bg-background shadow-sm"
          role="presentation"
        >
          <ul id={listId} role="listbox" aria-label="Product suggestions" className="max-h-[60vh] overflow-y-auto">
            {suggestions.map((p, i) => (
              <li key={p.slug} id={`${listId}-opt-${i}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => goToProduct(p.slug)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                    i === active ? "bg-muted" : "hover:bg-muted/60"
                  }`}
                >
                  <span className="h-11 w-11 shrink-0 overflow-hidden bg-muted">
                    {p.images[0] && (
                      <ProductImage
                        src={p.images[0]}
                        alt={p.name}
                        sizes="44px"
                        width={88}
                        height={88}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-base leading-tight">{p.name}</span>
                    <span className="block text-[11px] tabular-nums text-foreground/60">
                      {formatPrice(displayPrice(p))}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {suggestions.length === 0 && (
              <li className="px-3 py-3 text-[13px] text-foreground/60">
                {isFetching ? "Searching…" : "No products found"}
              </li>
            )}
          </ul>
          {suggestions.length > 0 && (
            <button
              type="submit"
              className="block w-full border-t border-border px-3 py-2 text-left text-[11px] uppercase tracking-[0.18em] text-foreground/70 hover:text-foreground"
            >
              See all results
            </button>
          )}
        </div>
      )}
    </form>
  );

  return (
    <div ref={wrapRef} className="flex items-center">
      {/* Desktop / tablet: inline field */}
      <div className="hidden md:block w-44 lg:w-56">{field}</div>

      {/* Mobile: icon toggles a panel below the header */}
      <button
        type="button"
        className="md:hidden p-2 text-foreground hover:opacity-70 transition"
        aria-label={open ? "Close search" : "Open search"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={20} strokeWidth={1.5} /> : <Search size={20} strokeWidth={1.5} />}
      </button>
      {open && (
        <div className="md:hidden absolute inset-x-0 top-full z-50 border-b border-border bg-background px-6 py-3">
          {field}
        </div>
      )}
    </div>
  );
}
