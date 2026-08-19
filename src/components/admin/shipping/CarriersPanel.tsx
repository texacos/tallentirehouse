import { useEffect, useRef, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
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

  const { data: carriers = [] } = useCarriers();
  const save = useSaveCarrier();
  const del = useDeleteCarrier();
  const [draft, setDraft] = useState<Draft | null>(null);
  const loadedFor = useRef<string | null>(null);

  // Show the selected carrier's general details, ready to edit.
  useEffect(() => {
    if (!selectedId) return;
    if (loadedFor.current === selectedId) return;
    const selected = carriers.find((c) => c.id === selectedId);
    if (!selected) return;
    loadedFor.current = selectedId;
    setDraft({ ...selected });
  }, [selectedId, carriers]);

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
          if (saved?.id) {
            loadedFor.current = null;
            onSelect?.(saved.id);
          } else {
            setDraft(null);
          }
        },

        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          General settings for the selected carrier. Every rate table, country rule and
          surcharge belongs to a carrier.
        </p>
        <Button size="sm" onClick={() => setDraft(emptyDraft())}>
          <Plus /> New carrier
        </Button>
      </div>

      {draft && (
        <div className="rounded-md border border-border p-5 space-y-4">
          <h3 className="font-display text-xl">
            {draft.id ? `${draft.name || "Carrier"} — general settings` : "New carrier"}
          </h3>
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
            {draft.id && (
              <Check
                label="Delete carrier"
                checked={false}
                onChange={(v) => {
                  if (!v || !draft.id) return;
                  if (!confirm(`Delete ${draft.name} and all of its shipping data?`)) return;
                  del.mutate(draft.id, {
                    onSuccess: () => {
                      toast.success("Carrier deleted.");
                      loadedFor.current = null;
                      setDraft(null);
                      const next = carriers.find((c) => c.id !== draft.id);
                      if (next) onSelect?.(next.id);
                    },
                    onError: (e) => toast.error(e.message),
                  });
                }}
              />
            )}
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
