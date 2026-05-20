// Client-side store for manually-created products.
// Persists to localStorage and exposes a React hook that re-renders
// consumers when the store changes. No backend required.

import { useSyncExternalStore } from "react";
import { PRODUCTS, type Product } from "./products";

const STORAGE_KEY = "tallentire.customProducts.v1";

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Product[]) : [];
  } catch {
    return [];
  }
}

function write(next: Product[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  for (const l of listeners) l();
}

// Stable snapshot — useSyncExternalStore requires referential stability
// between updates so we cache the last array and only swap when storage
// actually changes.
let cache: Product[] = read();
let cacheKey = JSON.stringify(cache);
function refreshCache() {
  const next = read();
  const key = JSON.stringify(next);
  if (key !== cacheKey) {
    cache = next;
    cacheKey = key;
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      refreshCache();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Product[] {
  refreshCache();
  return cache;
}

const EMPTY: Product[] = [];
function getServerSnapshot(): Product[] {
  return EMPTY;
}

export function useCustomProducts(): Product[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Hook returning the union of catalog + custom products (custom listed first).
export function useAllProducts(): Product[] {
  const custom = useCustomProducts();
  if (custom.length === 0) return PRODUCTS;
  return [...custom, ...PRODUCTS];
}

export function addCustomProduct(product: Product) {
  const current = read();
  if (current.some((p) => p.slug === product.slug) ||
      PRODUCTS.some((p) => p.slug === product.slug)) {
    throw new Error(`A product with the slug "${product.slug}" already exists.`);
  }
  write([product, ...current]);
}

export function updateCustomProduct(slug: string, product: Product) {
  const current = read();
  const next = current.map((p) => (p.slug === slug ? product : p));
  write(next);
}

export function deleteCustomProduct(slug: string) {
  write(read().filter((p) => p.slug !== slug));
}

export function isCustomProduct(slug: string): boolean {
  return read().some((p) => p.slug === slug);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
