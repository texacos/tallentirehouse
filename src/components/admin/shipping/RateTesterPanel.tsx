import { useState } from "react";
import { useShippingDestinations, useShippingQuote } from "@/lib/shipping";
import type { Carrier } from "@/lib/shipping-admin";
import { Input } from "@/components/ui/input";
import { Field } from "./CarriersPanel";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function RateTesterPanel({ carrier }: { carrier: Carrier }) {
  const { data: destinations = [] } = useShippingDestinations();
  const [country, setCountry] = useState("");
  const [weight, setWeight] = useState(1);
  const [subtotal, setSubtotal] = useState(0);

  const { data, isFetching } = useShippingQuote({
    country,
    weightKg: weight,
    subtotal,
    enabled: !!country,
  });
  const quote = data?.quote ?? null;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Runs the live quoting engine exactly as checkout does, for {carrier.name}.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Destination">
          <select
            className={selectClass}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">Select a country…</option>
            {destinations.map((d) => (
              <option key={d.country} value={d.country}>
                {d.country}
                {d.status === "rated" ? "" : ` (${d.status.replace("_", " ")})`}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Order weight (kg)">
          <Input
            type="number"
            step="0.1"
            min="0"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          />
        </Field>
        <Field label={`Order subtotal (${carrier.currency})`}>
          <Input
            type="number"
            step="1"
            min="0"
            value={subtotal}
            onChange={(e) => setSubtotal(Number(e.target.value))}
          />
        </Field>
      </div>

      <div className="rounded-md border border-border p-5 text-sm">
        {!country ? (
          <p className="text-muted-foreground">Pick a destination to see a quote.</p>
        ) : isFetching ? (
          <p className="text-muted-foreground">Calculating…</p>
        ) : !quote ? (
          <p className="text-muted-foreground">No carrier configured.</p>
        ) : quote.status === "rated" ? (
          <dl className="space-y-1">
            <Row label="Billable weight" value={`${quote.billableWeightKg.toFixed(2)} kg`} />
            <Row label="Tier" value={`up to ${quote.tierMaxWeightKg} kg`} />
            <Row
              label="Base rate"
              value={`${quote.currency} ${quote.baseAmount.toFixed(2)}`}
            />
            {quote.surcharges.map((s) => (
              <Row
                key={s.label}
                label={s.label}
                value={`${quote.currency} ${s.amount.toFixed(2)}`}
              />
            ))}
            <Row
              label="Total"
              value={quote.free ? "Free" : `${quote.currency} ${quote.total.toFixed(2)}`}
            />
          </dl>
        ) : (
          <div className="space-y-2">
            <p>
              <span className="font-medium">{quote.status.replace("_", " ")}</span> —{" "}
              {quote.reason.replace(/_/g, " ")} (billable {quote.billableWeightKg.toFixed(2)} kg)
            </p>
            {data?.message && (
              <div
                className="text-xs text-muted-foreground [&_p]:mt-2 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: data.message }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
