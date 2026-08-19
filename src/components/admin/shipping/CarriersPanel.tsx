import { useEffect, useState } from "react";
import { Plus, Trash2, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCarriers,
  useSaveCarrier,
  useDeleteCarrier,
  type Carrier,
} from "@/lib/shipping-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Draft = Partial<Carrier> & { code: string; name: string };

const emptyDraft = (): Draft => ({
  code: "",
  name: "",
  origin_country: "Sri Lanka",
  currency: "USD",
  max_weight_kg: 6,
  weight_interval_kg: 0.5,
  round_weight: true,
  free_shipping_threshold: null,
  is_active: true,
  is_default: false,
  sort_order: 0,
});

export function CarriersPanel({
  selectedId,
  onSelect,
}: {
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {

  const { data: carriers = [], isLoading } = useCarriers();
  const save = useSaveCarrier();
  const del = useDeleteCarrier();
  const [draft, setDraft] = useState<Draft | null>(null);

  // Always show the selected carrier's general details, ready to edit.
  useEffect(() => {
    const selected = carriers.find((c) => c.id === selectedId);
    if (selected) setDraft({ ...selected });
    else setDraft(null);
  }, [selectedId, carriers]);


  function edit(c: Carrier) {
    setDraft({ ...c });
  }

  function submit() {
    if (!draft) return;
    if (!draft.code.trim() || !draft.name.trim()) {
      toast.error("Code and name are required.");
      return;
    }
    save.mutate(
      { ...draft, code: draft.code.trim().toLowerCase(), name: draft.name.trim() },
      {
        onSuccess: (saved) => {
          toast.success("Carrier saved.");
          setDraft(null);
          if (saved?.id) onSelect?.(saved.id);
        },

        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Every rate table, country rule and surcharge belongs to a carrier.
        </p>
        <Button size="sm" onClick={() => setDraft(emptyDraft())}>
          <Plus /> New carrier
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Carrier</th>
                <th className="px-4 py-3">Origin</th>
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3">Max kg</th>
                <th className="px-4 py-3">Interval</th>
                <th className="px-4 py-3">Free over</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {carriers.map((c) => (
                <tr key={c.id} className={c.id === selectedId ? "bg-secondary/40" : ""}>
                  <td className="px-4 py-3">
                    <button className="font-medium hover:underline" onClick={() => edit(c)}>
                      {c.name}
                    </button>
                    <span className="ml-2 text-xs text-muted-foreground">{c.code}</span>
                    {c.is_default && (
                      <Star size={12} className="ml-2 inline fill-current text-foreground/60" />
                    )}
                  </td>
                  <td className="px-4 py-3">{c.origin_country}</td>
                  <td className="px-4 py-3">{c.currency}</td>
                  <td className="px-4 py-3 tabular-nums">{c.max_weight_kg}</td>
                  <td className="px-4 py-3 tabular-nums">{c.weight_interval_kg}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {c.free_shipping_threshold == null ? "—" : c.free_shipping_threshold}
                  </td>
                  <td className="px-4 py-3">{c.is_active ? "Active" : "Disabled"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {onSelect && (
                      <Button
                        variant={c.id === selectedId ? "secondary" : "outline"}
                        size="sm"
                        className="mr-2"
                        onClick={() => onSelect(c.id)}
                      >
                        {c.id === selectedId ? "Selected" : "Select"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${c.name}`}
                      onClick={() => {
                        if (!confirm(`Delete ${c.name} and all of its shipping data?`)) return;
                        del.mutate(c.id, {
                          onSuccess: () => toast.success("Carrier deleted."),
                          onError: (e) => toast.error(e.message),
                        });
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <div className="rounded-md border border-border p-5 space-y-4">
          <h3 className="font-display text-xl">{draft.id ? "Edit carrier" : "New carrier"}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Code">
              <Input
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
            </Field>
            <Field label="Origin country">
              <Input
                value={draft.origin_country ?? ""}
                onChange={(e) => setDraft({ ...draft, origin_country: e.target.value })}
              />
            </Field>
            <Field label="Currency">
              <Input
                value={draft.currency ?? "USD"}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
              />
            </Field>
            <Field label="Max weight (kg)">
              <Input
                type="number"
                step="0.5"
                value={draft.max_weight_kg ?? 0}
                onChange={(e) => setDraft({ ...draft, max_weight_kg: Number(e.target.value) })}
              />
            </Field>
            <Field label="Billing interval (kg)">
              <Input
                type="number"
                step="0.1"
                value={draft.weight_interval_kg ?? 0.5}
                onChange={(e) =>
                  setDraft({ ...draft, weight_interval_kg: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Free shipping over (blank = never)">
              <Input
                type="number"
                step="1"
                value={draft.free_shipping_threshold ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    free_shipping_threshold:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Sort order">
              <Input
                type="number"
                value={draft.sort_order ?? 0}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <Check
              label="Round weight up to interval"
              checked={!!draft.round_weight}
              onChange={(v) => setDraft({ ...draft, round_weight: v })}
            />
            <Check
              label="Active"
              checked={!!draft.is_active}
              onChange={(v) => setDraft({ ...draft, is_active: v })}
            />
            <Check
              label="Default carrier"
              checked={!!draft.is_default}
              onChange={(v) => setDraft({ ...draft, is_default: v })}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} Save carrier
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Field({
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
      <Label className="text-xs uppercase tracking-[0.16em] text-foreground/70">{label}</Label>
      {children}
    </div>
  );
}

export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        className="accent-foreground"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
