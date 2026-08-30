import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { suggestAramexCities, type CitySuggestion } from "@/lib/aramex-domestic.functions";

/**
 * Sri Lanka delivery-city picker. The value must come from the Aramex Domestic
 * city list, so free text is kept only as a search term until a suggestion is
 * chosen — the server refuses to quote an unmatched city.
 */
export function CityAutocomplete({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (city: string) => void;
  id?: string;
}) {
  const [term, setTerm] = useState(value);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => setTerm(value), [value]);

  useEffect(() => {
    if (!touched) return;
    const q = term.trim();
    if (q.length < 2 || q === value) {
      setResults([]);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      suggestAramexCities({ data: { term: q } })
        .then((rows) => {
          if (id !== requestId.current) return;
          setResults(rows);
          setOpen(true);
        })
        .catch(() => {
          if (id === requestId.current) setResults([]);
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false);
        });
    }, 220);
    return () => clearTimeout(timer);
  }, [term, touched, value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const unmatched = useMemo(
    () => touched && term.trim().length >= 2 && term.trim() !== value,
    [touched, term, value],
  );

  return (
    <div className="relative" ref={boxRef}>
      <Input
        id={id}
        value={term}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-autocomplete="list"
        placeholder="Start typing your city…"
        onChange={(e) => {
          setTouched(true);
          setTerm(e.target.value);
          if (value) onChange("");
        }}
        onFocus={() => {
          if (results.length) setOpen(true);
        }}
      />
      {open && results.length > 0 && (
        <ul
          role="listbox"
          id={id ? `${id}-listbox` : undefined}
          aria-label="City suggestions"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-background shadow-lg"
        >
          {results.map((r) => (
            <li key={r.city} role="option" aria-selected={r.city === value}>
              <button
                type="button"
                tabIndex={-1}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange(r.city);
                  setTerm(r.city);
                  setOpen(false);
                  setResults([]);
                }}
              >

                <span>{r.city}</span>
                {r.rateGroup === "NO_RATE" && (
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    No online rate
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading && <p className="mt-1 text-xs text-muted-foreground">Searching cities…</p>}
      {!loading && unmatched && (
        <p className="mt-1 text-xs text-muted-foreground">
          Select your city from the suggested results so we can calculate delivery.
        </p>
      )}
    </div>
  );
}
