import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useSurcharges,
  useSaveSurcharge,
  useDeleteSurcharge,
  type Surcharge,
} from "@/lib/shipping-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Check } from "./CarriersPanel";

type Draft = Partial<Surcharge> & { label: string };

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const emptyDraft = (): Draft => ({
  label: "",
  kind: "fuel",
  calc: "percent",
  amount: 0,
  country: null,
  is_active: true,
  starts_at: null,
  ends_at: null,
});

const dateValue = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

export function SurchargesPanel({ carrierId }: { carrierId: string }) {
  const { data: surcharges = [], isLoading } = useSurcharges(carrierId);
  const save = useSaveSurcharge();
  const del = useDeleteSurcharge();
  const [draft, setDraft] = useState<Draft | null>(null);

  function submit() {
    if (!draft) return;
    if (!draft.label.trim()) {
      toast.error("A label is required.");
      return;
    }
    save.mutate(
      {
        ...draft,
        carrier_id: carrierId,
        label: draft.label.trim(),
        country: draft.country?.trim() ? draft.country.trim() : null,
        amount: Number(draft.amount ?? 0),
      },
      {
        onSuccess: () => {
          toast.success("Surcharge saved.");
          setDraft(null);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Percentage surcharges apply to the base rate; fixed ones add a flat amount.
        </p>
        <Button size="sm" onClick={() => setDraft(emptyDraft())}>
          <Plus /> New surcharge
        </Button>
      </div>

      {draft && (
        <div className="rounded-md border border-border p-5 space-y-4">
          <h3 className="font-display text-xl">{draft.id ? "Edit surcharge" : "New surcharge"}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Label">
              <Input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </Field>
            <Field label="Kind">
              <select
                className={selectClass}
                value={draft.kind ?? "custom"}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as Surcharge["kind"] })}
              >
                <option value="fuel">Fuel</option>
                <option value="remote_area">Remote area</option>
                <option value="peak_season">Peak season</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Calculation">
              <select
                className={selectClass}
                value={draft.calc ?? "percent"}
                onChange={(e) => setDraft({ ...draft, calc: e.target.value as Surcharge["calc"] })}
              >
                <option value="percent">Percent of base</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </Field>
            <Field label={draft.calc === "fixed" ? "Amount" : "Percent"}>
              <Input
                type="number"
                step="0.01"
                value={draft.amount ?? 0}
                onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Country (blank = all)">
              <Input
                value={draft.country ?? ""}
                onChange={(e) => setDraft({ ...draft, country: e.target.value })}
              />
            </Field>
            <Field label="Starts">
              <Input
                type="date"
                value={dateValue(draft.starts_at)}
                onChange={(e) =>
                  setDraft({ ...draft, starts_at: e.target.value ? e.target.value : null })
                }
              />
            </Field>
            <Field label="Ends">
              <Input
                type="date"
                value={dateValue(draft.ends_at)}
                onChange={(e) =>
                  setDraft({ ...draft, ends_at: e.target.value ? e.target.value : null })
                }
              />
            </Field>
          </div>
          <Check
            label="Active"
            checked={!!draft.is_active}
            onChange={(v) => setDraft({ ...draft, is_active: v })}
          />
          <div className="flex gap-2">
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} Save surcharge
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {surcharges.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2">
                    <button className="hover:underline" onClick={() => setDraft({ ...s })}>
                      {s.label}
                    </button>
                  </td>
                  <td className="px-4 py-2">{s.kind.replace("_", " ")}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {s.calc === "percent" ? `${s.amount}%` : s.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-2">{s.country ?? "All"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {s.starts_at || s.ends_at
                      ? `${dateValue(s.starts_at) || "…"} → ${dateValue(s.ends_at) || "…"}`
                      : "Always"}
                  </td>
                  <td className="px-4 py-2">{s.is_active ? "Active" : "Disabled"}</td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${s.label}`}
                      onClick={() => {
                        if (!confirm(`Delete ${s.label}?`)) return;
                        del.mutate(s.id, {
                          onSuccess: () => toast.success("Surcharge deleted."),
                          onError: (e) => toast.error(e.message),
                        });
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
              {!surcharges.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    No surcharges yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
