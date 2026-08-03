import { useRef, useState } from "react";
import { Loader2, Upload, Download, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCountryRules,
  useRateGroups,
  useImportBatches,
  useImportCountryRules,
  useImportRateGroups,
  useRollbackBatch,
  countryRulesToCsv,
  rateGroupsToCsv,
  downloadCsv,
  type ImportResult,
} from "@/lib/shipping-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./CarriersPanel";

type Kind = "rate_groups" | "country_rules";

export function ImportExportPanel({ carrierId }: { carrierId: string }) {
  const { data: groups = [] } = useRateGroups(carrierId);
  const { data: rules = [] } = useCountryRules(carrierId);
  const { data: batches = [] } = useImportBatches(carrierId);
  const importGroups = useImportRateGroups();
  const importRules = useImportCountryRules();
  const rollback = useRollbackBatch();

  const [label, setLabel] = useState("");
  const [result, setResult] = useState<(ImportResult & { kind: Kind }) | null>(null);
  const groupInput = useRef<HTMLInputElement>(null);
  const ruleInput = useRef<HTMLInputElement>(null);

  const pending = importGroups.isPending || importRules.isPending;

  async function run(kind: Kind, file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const mutation = kind === "rate_groups" ? importGroups : importRules;
    mutation.mutate(
      { carrierId, text, fileName: file.name, userLabel: label.trim() || null },
      {
        onSuccess: (r) => {
          setResult({ ...r, kind });
          toast.success(
            `${r.created} created, ${r.updated} updated, ${r.skipped} skipped.`,
          );
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="space-y-6">
      <Field label="Import label (optional)" className="max-w-sm">
        <Input
          value={label}
          placeholder="e.g. Aramex 2026 rates"
          onChange={(e) => setLabel(e.target.value)}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border p-5 space-y-3">
          <h3 className="font-display text-xl">Rate groups</h3>
          <p className="text-xs text-muted-foreground">
            Accepts the wide weight × group matrix or a long
            rate_group,max_weight_kg,price file. Existing groups are replaced tier-for-tier.
          </p>
          <input
            ref={groupInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              void run("rate_groups", e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => groupInput.current?.click()}>
              {importGroups.isPending ? <Loader2 className="animate-spin" /> : <Upload />} Import CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!groups.length}
              onClick={() => downloadCsv("rate_groups.csv", rateGroupsToCsv(groups))}
            >
              <Download /> Export {groups.length} groups
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border p-5 space-y-3">
          <h3 className="font-display text-xl">Country rules</h3>
          <p className="text-xs text-muted-foreground">
            country,country_code,rate_group — values of “no rate” or “no service” set the
            status instead of a group.
          </p>
          <input
            ref={ruleInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              void run("country_rules", e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => ruleInput.current?.click()}>
              {importRules.isPending ? <Loader2 className="animate-spin" /> : <Upload />} Import CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!rules.length}
              onClick={() =>
                downloadCsv("country_rate_groups.csv", countryRulesToCsv(rules, groups))
              }
            >
              <Download /> Export {rules.length} countries
            </Button>
          </div>
        </div>
      </div>

      {result && (
        <div className="rounded-md border border-border p-5 text-sm space-y-2">
          <p className="font-medium">
            {result.kind === "rate_groups" ? "Rate groups" : "Country rules"} import — {result.total}{" "}
            rows: {result.created} created, {result.updated} updated, {result.skipped} skipped.
          </p>
          {result.warnings.length > 0 && (
            <details>
              <summary className="cursor-pointer text-muted-foreground">
                {result.warnings.length} warnings
              </summary>
              <ul className="mt-2 max-h-48 list-disc overflow-auto pl-5 text-xs text-muted-foreground">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div>
        <h3 className="font-display text-xl mb-3">Import history</h3>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Rows</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {batches.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(b.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{b.kind.replace("_", " ")}</td>
                  <td className="px-4 py-2 text-muted-foreground">{b.file_name ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{b.user_label ?? "—"}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {b.rows_created}c / {b.rows_updated}u / {b.rows_skipped}s
                  </td>
                  <td className="px-4 py-2 text-right">
                    {b.rolled_back_at ? (
                      <span className="text-xs text-muted-foreground">Rolled back</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rollback.isPending}
                        onClick={() => {
                          if (!confirm("Restore the data as it was before this import?")) return;
                          rollback.mutate(b, {
                            onSuccess: () => toast.success("Rolled back."),
                            onError: (e) => toast.error(e.message),
                          });
                        }}
                      >
                        <Undo2 size={14} /> Roll back
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!batches.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No imports yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
