import { useMemo, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useRateGroups,
  useSaveRateGroup,
  useDeleteRateGroup,
  type RateGroup,
  type RateTier,
} from "@/lib/shipping-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./CarriersPanel";

type Draft = {
  id?: string;
  code: string;
  label: string;
  notes: string;
  tiers: RateTier[];
};

export function RateGroupsPanel({ carrierId }: { carrierId: string }) {
  const { data: groups = [], isLoading } = useRateGroups(carrierId);
  const save = useSaveRateGroup();
  const del = useDeleteRateGroup();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.code.toLowerCase().includes(q) || (g.label ?? "").toLowerCase().includes(q),
    );
  }, [groups, search]);

  function edit(g: RateGroup & { tiers: RateTier[] }) {
    setDraft({
      id: g.id,
      code: g.code,
      label: g.label ?? "",
      notes: g.notes ?? "",
      tiers: g.tiers.map((t) => ({ ...t })),
    });
  }

  function submit() {
    if (!draft) return;
    if (!draft.code.trim()) {
      toast.error("A group code is required.");
      return;
    }
    save.mutate(
      {
        id: draft.id,
        carrier_id: carrierId,
        code: draft.code.trim(),
        label: draft.label.trim() || null,
        notes: draft.notes.trim() || null,
        tiers: draft.tiers,
      },
      {
        onSuccess: () => {
          toast.success("Rate group saved.");
          setDraft(null);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  function setTier(i: number, patch: Partial<RateTier>) {
    if (!draft) return;
    const tiers = draft.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    setDraft({ ...draft, tiers });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search rate groups…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-sm text-muted-foreground">
          {filtered.length} of {groups.length}
        </span>
        <Button
          size="sm"
          className="ml-auto"
          onClick={() => setDraft({ code: "", label: "", notes: "", tiers: [] })}
        >
          <Plus /> New rate group
        </Button>
      </div>

      {draft && (
        <div className="rounded-md border border-border p-5 space-y-4">
          <h3 className="font-display text-xl">
            {draft.id ? `Edit ${draft.code}` : "New rate group"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Code">
              <Input
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
            </Field>
            <Field label="Label">
              <Input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </Field>
            <Field label="Notes">
              <Input
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-foreground/70">
              Weight tiers (price applies up to and including the weight)
            </p>
            <div className="max-h-72 overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-2">Up to kg</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {draft.tiers.map((t, i) => (
                    <tr key={t.id ?? `new-${i}`}>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          step="0.5"
                          value={t.max_weight_kg}
                          onChange={(e) =>
                            setTier(i, { max_weight_kg: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          value={t.price}
                          onChange={(e) => setTier(i, { price: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove tier"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              tiers: draft.tiers.filter((_, idx) => idx !== i),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!draft.tiers.length && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                        No tiers yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const last = draft.tiers[draft.tiers.length - 1];
                setDraft({
                  ...draft,
                  tiers: [
                    ...draft.tiers,
                    {
                      max_weight_kg: last ? Number(last.max_weight_kg) + 0.5 : 0.5,
                      price: last ? last.price : 0,
                    },
                  ],
                });
              }}
            >
              <Plus /> Add tier
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} Save rate group
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
        <div className="max-h-[32rem] overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Tiers</th>
                <th className="px-4 py-3">Range</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((g) => {
                const prices = g.tiers.map((t) => t.price);
                return (
                  <tr key={g.id}>
                    <td className="px-4 py-2">
                      <button className="font-medium hover:underline" onClick={() => edit(g)}>
                        {g.code}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{g.label ?? "—"}</td>
                    <td className="px-4 py-2 tabular-nums">{g.tiers.length}</td>
                    <td className="px-4 py-2 tabular-nums">
                      {prices.length
                        ? `${Math.min(...prices).toFixed(2)} – ${Math.max(...prices).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${g.code}`}
                        onClick={() => {
                          if (!confirm(`Delete ${g.code} and its tiers?`)) return;
                          del.mutate(g.id, {
                            onSuccess: () => toast.success("Rate group deleted."),
                            onError: (e) => toast.error(e.message),
                          });
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No rate groups match.
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
