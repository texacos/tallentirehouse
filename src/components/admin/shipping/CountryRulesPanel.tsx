import { useMemo, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCountryRules,
  useRateGroups,
  useSaveCountryRule,
  useDeleteCountryRule,
  type CountryRule,
  type ServiceStatus,
} from "@/lib/shipping-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./CarriersPanel";

type Draft = {
  id?: string;
  country: string;
  country_code: string;
  status: ServiceStatus;
  rate_group_id: string | null;
};

const STATUS_LABEL: Record<ServiceStatus, string> = {
  rated: "Rated",
  no_rate: "No rate",
  no_service: "No service",
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function CountryRulesPanel({ carrierId }: { carrierId: string }) {
  const { data: rules = [], isLoading } = useCountryRules(carrierId);
  const { data: groups = [] } = useRateGroups(carrierId);
  const save = useSaveCountryRule();
  const del = useDeleteCountryRule();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ServiceStatus>("all");
  const [draft, setDraft] = useState<Draft | null>(null);

  const codeById = useMemo(
    () => new Map(groups.map((g) => [g.id, g.code])),
    [groups],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter(
      (r) =>
        (statusFilter === "all" || r.status === statusFilter) &&
        (!q ||
          r.country.toLowerCase().includes(q) ||
          (r.country_code ?? "").toLowerCase().includes(q) ||
          (codeById.get(r.rate_group_id ?? "") ?? "").toLowerCase().includes(q)),
    );
  }, [rules, search, statusFilter, codeById]);

  function edit(r: CountryRule) {
    setDraft({
      id: r.id,
      country: r.country,
      country_code: r.country_code ?? "",
      status: r.status,
      rate_group_id: r.rate_group_id,
    });
  }

  function submit() {
    if (!draft) return;
    if (!draft.country.trim()) {
      toast.error("Country is required.");
      return;
    }
    if (draft.status === "rated" && !draft.rate_group_id) {
      toast.error("Pick a rate group for rated destinations.");
      return;
    }
    save.mutate(
      {
        id: draft.id,
        carrier_id: carrierId,
        country: draft.country.trim(),
        country_code: draft.country_code.trim() || null,
        status: draft.status,
        rate_group_id: draft.rate_group_id,
      },
      {
        onSuccess: () => {
          toast.success("Country rule saved.");
          setDraft(null);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search country or rate group…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={`${selectClass} max-w-[10rem]`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | ServiceStatus)}
        >
          <option value="all">All statuses</option>
          <option value="rated">Rated</option>
          <option value="no_rate">No rate</option>
          <option value="no_service">No service</option>
        </select>
        <span className="text-sm text-muted-foreground">
          {filtered.length} of {rules.length}
        </span>
        <Button
          size="sm"
          className="ml-auto"
          onClick={() =>
            setDraft({ country: "", country_code: "", status: "rated", rate_group_id: null })
          }
        >
          <Plus /> New rule
        </Button>
      </div>

      {draft && (
        <div className="rounded-md border border-border p-5 space-y-4">
          <h3 className="font-display text-xl">{draft.id ? "Edit rule" : "New rule"}</h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Country">
              <Input
                value={draft.country}
                onChange={(e) => setDraft({ ...draft, country: e.target.value })}
              />
            </Field>
            <Field label="ISO code">
              <Input
                value={draft.country_code}
                onChange={(e) => setDraft({ ...draft, country_code: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <select
                className={selectClass}
                value={draft.status}
                onChange={(e) =>
                  setDraft({ ...draft, status: e.target.value as ServiceStatus })
                }
              >
                <option value="rated">Rated</option>
                <option value="no_rate">No rate</option>
                <option value="no_service">No service</option>
              </select>
            </Field>
            <Field label="Rate group">
              <select
                className={selectClass}
                disabled={draft.status !== "rated"}
                value={draft.rate_group_id ?? ""}
                onChange={(e) => setDraft({ ...draft, rate_group_id: e.target.value || null })}
              >
                <option value="">—</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} Save rule
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
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">ISO</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Rate group</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2">
                    <button className="hover:underline" onClick={() => edit(r)}>
                      {r.country}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{r.country_code ?? "—"}</td>
                  <td className="px-4 py-2">{STATUS_LABEL[r.status]}</td>
                  <td className="px-4 py-2">{codeById.get(r.rate_group_id ?? "") ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${r.country}`}
                      onClick={() => {
                        if (!confirm(`Delete the rule for ${r.country}?`)) return;
                        del.mutate(r.id, {
                          onSuccess: () => toast.success("Rule deleted."),
                          onError: (e) => toast.error(e.message),
                        });
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No country rules match.
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
