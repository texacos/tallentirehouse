import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Minus, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/products";
import { useShippingDestinations, useShippingOptions } from "@/lib/shipping";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your basket — Tallentire House" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

type Address = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  email: string;
  phone: string;
};

const emptyAddress = (): Address => ({
  name: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postcode: "",
  country: "",
  email: "",
  phone: "",
});

function CartPage() {
  const { detailed, subtotal, setQty, remove, count } = useCart();
  const [placed, setPlaced] = useState(false);
  const [billing, setBilling] = useState<Address>(emptyAddress());
  const [deliverySame, setDeliverySame] = useState(true);
  const [shipping, setShipping] = useState<Address>(emptyAddress());

  const destinationsQ = useShippingDestinations();

  const totalWeight = useMemo(
    () => detailed.reduce((s, i) => s + (i.product.weight_kg ?? 0) * i.qty, 0),
    [detailed],
  );

  // Keep delivery address in sync with billing when they are the same.
  useEffect(() => {
    if (deliverySame) {
      setShipping(billing);
    }
  }, [deliverySame, billing]);

  const optionsQ = useShippingOptions({
    country: shipping.country,
    weightKg: Number(totalWeight.toFixed(3)),
    subtotal,
    enabled: count > 0,
  });

  const options = useMemo(() => optionsQ.data ?? [], [optionsQ.data]);
  const rated = useMemo(
    () => options.filter((o) => o.quote?.status === "rated"),
    [options],
  );
  const [carrierCode, setCarrierCode] = useState<string>("");

  const isPickup = (code: string) => code === "local-pickup";
  const deliveryCountry = shipping.country.trim().toLowerCase();
  const preferPickup = deliveryCountry === "sri lanka";

  // Any change of destination invalidates a previously chosen carrier.
  useEffect(() => {
    setCarrierCode("");
  }, [deliveryCountry]);

  const defaultOption = useMemo(() => {
    if (rated.length === 0) return null;
    if (preferPickup) {
      return rated.find((o) => isPickup(o.carrierCode)) ?? rated[0]!;
    }
    return rated.find((o) => !isPickup(o.carrierCode)) ?? rated[0]!;
  }, [rated, preferPickup]);

  useEffect(() => {
    if (!defaultOption) {
      setCarrierCode("");
      return;
    }
    if (!rated.some((o) => o.carrierCode === carrierCode)) {
      setCarrierCode(defaultOption.carrierCode);
    }
  }, [rated, carrierCode, defaultOption]);


  const selected =
    rated.find((o) => o.carrierCode === carrierCode) ?? defaultOption;
  const quote = selected?.quote ?? options[0]?.quote ?? null;
  // Messages from carriers that could not be rated (e.g. Aramex "no service"),
  // shown even when another carrier (Local Pick-up) is available.
  const unratedMessages = useMemo(
    () =>
      options
        .filter((o) => o.quote?.status !== "rated" && o.message)
        .map((o) => ({ carrierName: o.carrierName, message: o.message! })),
    [options],
  );
  const shippingUSD =
    selected?.quote?.status === "rated" ? selected.quote.total : null;


  const shippingKnown = shippingUSD != null;
  const total = subtotal + (shippingUSD ?? 0);

  const addressComplete =
    billing.name.trim() &&
    billing.line1.trim() &&
    billing.city.trim() &&
    billing.postcode.trim() &&
    billing.country.trim() &&
    billing.email.trim() &&
    (deliverySame ||
      (shipping.name.trim() &&
        shipping.line1.trim() &&
        shipping.city.trim() &&
        shipping.postcode.trim() &&
        shipping.country.trim()));

  const canPlace = count > 0 && shippingKnown && !!addressComplete;


  if (placed) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-32 text-center">
        <p className="eyebrow text-foreground/60">Thank you</p>
        <h1 className="mt-4 font-display text-5xl">Your order is on its way</h1>
        <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
          This is a preview checkout — connect Stripe to take live payments.
        </p>
        <Link
          to="/shop"
          className="mt-8 inline-block bg-foreground text-background px-8 py-4 text-xs uppercase tracking-[0.22em]"
        >
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
        <Link
          to="/shop"
          className="mt-8 inline-block border border-foreground px-8 py-4 text-xs uppercase tracking-[0.22em] hover:bg-foreground hover:text-background transition"
        >
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
        {/* Items + address */}
        <div className="lg:col-span-2 space-y-12">
          <ul className="divide-y divide-border border-t border-b border-border">
            {detailed.map(({ product, qty, lineTotal, unitPrice, size, variant }) => (
              <li key={product.slug + "::" + (size ?? "")} className="flex gap-5 py-6">
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
                      {size && (
                        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-[0.18em]">
                          Size: {size}
                        </p>
                      )}
                      {(variant?.sku || product.sku) && (
                        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-[0.18em]">
                          SKU: {variant?.sku || product.sku}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {product.weight_kg} kg each
                      </p>
                    </div>
                    <button
                      onClick={() => remove(product.slug, size)}
                      aria-label="Remove"
                      className="p-1 text-foreground/50 hover:text-foreground"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="mt-auto flex items-end justify-between pt-4">
                    <div className="inline-flex items-center border border-border">
                      <button
                        onClick={() => setQty(product.slug, qty - 1, size)}
                        className="p-2"
                        aria-label="Decrease"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="px-3 text-sm tabular-nums">{qty}</span>
                      <button
                        onClick={() => setQty(product.slug, qty + 1, size)}
                        className="p-2"
                        aria-label="Increase"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="tabular-nums">{formatPrice(lineTotal)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatPrice(unitPrice)} each
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <AddressBlock
            title="Billing address"
            address={billing}
            onChange={setBilling}
            countries={
              destinationsQ.data
                ?.filter((d) => d.status !== "no_service")
                .map((d) => d.country) ?? []
            }
            countriesLoading={destinationsQ.isLoading}
            requireContact
          />

          <div className="border border-border rounded-md p-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={deliverySame}
                onChange={(e) => setDeliverySame(e.target.checked)}
                className="accent-foreground"
              />
              <span>Delivery address is the same as Billing</span>
            </label>
          </div>

          {!deliverySame && (
            <AddressBlock
              title="Delivery address"
              address={shipping}
              onChange={setShipping}
              countries={destinationsQ.data?.map((d) => d.country) ?? []}
              countriesLoading={destinationsQ.isLoading}
            />
          )}

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
              <dt className="text-muted-foreground">Total weight</dt>
              <dd className="tabular-nums">{totalWeight.toFixed(2)} kg</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Billable weight</dt>
              <dd className="tabular-nums">
                {quote ? `${quote.billableWeightKg.toFixed(2)} kg` : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="tabular-nums">
                {!shipping.country
                  ? "Select country"
                  : optionsQ.isLoading || destinationsQ.isLoading
                    ? "…"
                    : quote?.status === "rated"
                      ? quote.free
                        ? "Free"
                        : formatPrice(quote.total)
                      : "Not available online"}
              </dd>
            </div>
            {quote?.status === "rated" &&
              quote.surcharges.map((s) => (
                <div key={s.label} className="flex justify-between text-xs">
                  <dt className="text-muted-foreground">{s.label}</dt>
                  <dd className="tabular-nums">included</dd>
                </div>
              ))}
            {quote?.status === "rated" && (
              <p className="text-xs text-muted-foreground">
                {quote.carrierName} · up to {quote.tierMaxWeightKg} kg tier.
              </p>
            )}
            {rated.length > 0 && (
              <div className="pt-2">
                <p className="text-xs uppercase tracking-[0.18em] text-foreground/70 mb-2">
                  Delivery method
                </p>
                <div className="space-y-2">
                  {rated.map((o) => (
                    <label
                      key={o.carrierCode}
                      className={`flex cursor-pointer items-center justify-between gap-3 border px-3 py-2 text-sm transition ${
                        o.carrierCode === selected?.carrierCode
                          ? "border-foreground"
                          : "border-border hover:border-foreground/40"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="carrier"
                          className="accent-foreground"
                          checked={o.carrierCode === selected?.carrierCode}
                          onChange={() => setCarrierCode(o.carrierCode)}
                        />
                        <span>{o.carrierName}</span>
                      </span>
                      <span className="tabular-nums">
                        {o.quote?.status === "rated" && o.quote.free
                          ? "Free"
                          : o.quote?.status === "rated"
                            ? formatPrice(o.quote.total)
                            : "—"}
                      </span>
                    </label>
                  ))}
                </div>
                {selected?.carrierCode === "local-pickup" && (
                  <div className="mt-3 border border-accent bg-accent/10 p-3 text-sm text-foreground">
                    <p className="flex items-center gap-2 font-semibold">
                      <AlertTriangle size={16} className="shrink-0" />
                      Local Pick-up is in-store collection only
                    </p>
                    <p className="mt-1">
                      Orders placed with Local Pick-up must be collected from our shop at{" "}
                      <strong>10 Leyn Baan Street, Galle Fort, Sri Lanka</strong>. Please do
                      not choose this option unless you can visit the store in person.
                    </p>
                  </div>
                )}
              </div>
            )}
            {unratedMessages.map((m) => (
              <div key={m.carrierName} className="text-xs text-muted-foreground [&_p]:mt-2">
                <p className="uppercase tracking-[0.18em] text-foreground/70">
                  {m.carrierName}
                </p>
                <div dangerouslySetInnerHTML={{ __html: m.message }} />
              </div>
            ))}

          </dl>

          <div className="my-5 rule" />
          <div className="flex justify-between text-base">
            <span>Total</span>
            <span className="tabular-nums">
              {shippingKnown ? formatPrice(total) : "—"}
            </span>
          </div>

          <button
            onClick={() => setPlaced(true)}
            disabled={!canPlace}
            className="mt-6 w-full bg-foreground text-background py-4 text-xs uppercase tracking-[0.22em] hover:bg-foreground/85 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Proceed to checkout
          </button>
          {!canPlace && (
            <p className="mt-3 text-xs text-muted-foreground text-center">
              Complete delivery address to calculate shipping.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function AddressBlock({
  title,
  address,
  onChange,
  countries,
  countriesLoading,
  requireContact,
}: {
  title: string;
  address: Address;
  onChange: (a: Address) => void;
  countries: string[];
  countriesLoading: boolean;
  requireContact?: boolean;
}) {
  function update<K extends keyof Address>(key: K, value: Address[K]) {
    onChange({ ...address, [key]: value });
  }
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Cell label="Country" className="sm:col-span-2">
          <select
            value={address.country}
            onChange={(e) => update("country", e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm w-full"
          >
            <option value="">
              {countriesLoading ? "Loading…" : "Select country"}
            </option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Cell>
        <Cell label="Full name" className="sm:col-span-2">
          <Input value={address.name} onChange={(e) => update("name", e.target.value)} />
        </Cell>
        <Cell label="Address line 1" className="sm:col-span-2">
          <Input value={address.line1} onChange={(e) => update("line1", e.target.value)} />
        </Cell>
        <Cell label="Address line 2 (optional)" className="sm:col-span-2">
          <Input value={address.line2} onChange={(e) => update("line2", e.target.value)} />
        </Cell>
        <Cell label="City">
          <Input value={address.city} onChange={(e) => update("city", e.target.value)} />
        </Cell>
        <Cell label="State / Region">
          <Input value={address.region} onChange={(e) => update("region", e.target.value)} />
        </Cell>
        <Cell label="Postal code">
          <Input value={address.postcode} onChange={(e) => update("postcode", e.target.value)} />
        </Cell>
        {requireContact && (
          <>
            <Cell label="Email">
              <Input
                type="email"
                value={address.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </Cell>
            <Cell label="Phone (optional)" className="sm:col-span-2">
              <Input value={address.phone} onChange={(e) => update("phone", e.target.value)} />
            </Cell>
          </>
        )}
      </div>
    </div>
  );
}

function Cell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs uppercase tracking-[0.18em] text-foreground/70">
        {label}
      </Label>
      {children}
    </div>
  );
}
