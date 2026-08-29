import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminAramexOverview,
  adminImportAramexCities,
  adminImportAramexRates,
  adminRecalculateAramexRates,
  adminSetAramexRounding,
  adminTestAramexRate,
  type AramexOverview,
  type AramexTestResult,
} from "@/lib/aramex-domestic.functions";
import type { CsvIssue } from "@/lib/aramex-domestic";

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="rounded-md border border-border p-5">
      <h3 className="font-display text-xl">{title}</h3>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function IssueList({ issues }: { issues: CsvIssue[] }) {
  if (!issues.length) return null;
  return (
    <ul className="max-h-48 overflow-auto rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
      {issues.map((i, n) => (
        <li key={n}>
          Row {i.row}
          {i.column ? ` · ${i.column}` : ""}: {i.message}
        </li>
      ))}
    </ul>
  );
}

export function AramexDomesticPanel() {
  const qc = useQueryClient();
  const overviewQ = useQuery({
    queryKey: ["admin", "aramex_domestic"],
    queryFn: (): Promise<AramexOverview> => adminAramexOverview(),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "aramex_domestic"] });

  const [cityIssues, setCityIssues] = useState<CsvIssue[]>([]);
  const [rateIssues, setRateIssues] = useState<CsvIssue[]>([]);
  const cityInput = useRef<HTMLInputElement>(null);
  const rateInput = useRef<HTMLInputElement>(null);

  const importCities = useMutation({
    mutationFn: async (file: File) =>
      adminImportAramexCities({ data: { csv: await file.text(), filename: file.name } }),
    onSuccess: (res) => {
      setCityIssues(res.issues ?? []);
      if (res.ok) {
        toast.success(`Imported ${res.total} cities (${res.noRate} with no online rate)`);
        refresh();
      } else {
        toast.error(res.error ?? "The city file could not be imported");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importRates = useMutation({
    mutationFn: async (file: File) =>
      adminImportAramexRates({ data: { csv: await file.text(), filename: file.name } }),
    onSuccess: (res) => {
      setRateIssues(res.issues ?? []);
      if (res.ok) {
        toast.success(`Imported ${res.rateCount} rates at ${res.exchangeRate} LKR/USD`);
        refresh();
      } else {
        toast.error(res.error ?? "The rate file could not be imported");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recalc = useMutation({
    mutationFn: () => adminRecalculateAramexRates(),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`Recalculated at ${res.exchangeRate} LKR/USD`);
        refresh();
      } else {
        toast.error(res.error ?? "Recalculation failed");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRounding = useMutation({
    mutationFn: (v: { mode: string; increment?: number; decimals?: number }) =>
      adminSetAramexRounding({ data: v }),
    onSuccess: (res: { ok: boolean; error?: string }) => {
      if (res.ok) {
        toast.success("Rounding saved and prices recalculated");
        refresh();
      } else {
        toast.error(res.error ?? "Could not save rounding");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [testCity, setTestCity] = useState("");
  const [testWeight, setTestWeight] = useState("1.2");
  const [testResult, setTestResult] = useState<AramexTestResult | null>(null);
  const runTest = useMutation({
    mutationFn: () =>
      adminTestAramexRate({ data: { city: testCity, weightKg: Number(testWeight) || 0 } }),
    onSuccess: setTestResult,
    onError: (e: Error) => toast.error(e.message),
  });

  const data = overviewQ.data;
  const active = data?.active ?? null;
  const busy = importCities.isPending || importRates.isPending || recalc.isPending || saveRounding.isPending;

  return (
    <div className="space-y-6">
      <Section
        title="Status"
        note="Aramex Domestic serves Sri Lanka only. Prices are held in Sri Lankan Rupees and converted to US Dollars using the weekly rate from the Currencies dashboard."
      >
        {overviewQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <Stat label="Cities loaded" value={`${data?.cities.total ?? 0}`} sub={`${data?.cities.noRate ?? 0} with no online rate`} />
            <Stat
              label="Exchange rate in use"
              value={active?.exchangeRate ? `${active.exchangeRate} LKR / USD` : "—"}
              sub={active?.exchangeRateDate ? `Rate date ${active.exchangeRateDate}` : "No prices published"}
            />
            <Stat label="Prices calculated" value={fmtDate(active?.calculatedAt)} sub={active ? `From ${active.sourceFilename || "CSV"} · ${active.initiatedBy}` : "—"} />
            <Stat
              label="Last update"
              value={data?.lastRun.status === "failed" ? "Failed" : data?.lastRun.status === "success" ? "Succeeded" : "—"}
              sub={`${data?.lastRun.kind || "—"} · ${fmtDate(data?.lastRun.at)}`}
            />
          </div>
        )}
        {data?.lastRun.status === "failed" && data.lastRun.error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {data.lastRun.error} — the previously published prices are still live.
          </p>
        )}
        {data && !data.exchangeRate && (
          <p className="rounded-md border border-accent bg-accent/10 p-3 text-xs">
            No USD/LKR rate is stored yet. Fetch one on the Currencies dashboard before importing rates.
          </p>
        )}
        <Button size="sm" variant="outline" disabled={recalc.isPending || !active} onClick={() => recalc.mutate()}>
          {recalc.isPending ? "Recalculating…" : "Recalculate prices now"}
        </Button>
      </Section>

      <Section
        title="Rounding"
        note="Applied after conversion. Rounding is always upward, so a converted price is never understated."
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.16em]">Rule</Label>
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={
                data?.rounding.mode === "decimals"
                  ? `decimals:${data.rounding.decimals}`
                  : `increment:${data?.rounding.increment ?? 1}`
              }
              disabled={busy}
              onChange={(e) => {
                const [mode, n] = e.target.value.split(":");
                saveRounding.mutate(
                  mode === "decimals"
                    ? { mode: "decimals", decimals: Number(n) }
                    : { mode: "increment", increment: Number(n) },
                );
              }}
            >
              <option value="increment:1">Round up to the next USD 1</option>
              <option value="increment:5">Round up to the next USD 5</option>
              <option value="increment:10">Round up to the next USD 10</option>
              <option value="decimals:2">Round up to 2 decimal places</option>
              <option value="decimals:1">Round up to 1 decimal place</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Changed {fmtDate(data?.rounding.changedAt)}. Saving re-publishes all prices immediately.
          </p>
        </div>
      </Section>

      <Section
        title="City list"
        note="CSV columns: City,Rate Group. Rate groups: RATE_GROUP_1…4 or NO_RATE. The file replaces the whole list."
      >
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={cityInput}
            type="file"
            accept=".csv,text/csv"
            className="text-sm"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCities.mutate(f);
              e.target.value = "";
            }}
          />
          {importCities.isPending && <span className="text-xs text-muted-foreground">Importing…</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          Last import: {fmtDate(data?.cities.importedAt)}
          {data?.cities.filename ? ` · ${data.cities.filename}` : ""}
        </p>
        <IssueList issues={cityIssues} />
      </Section>

      <Section
        title="Rate table (LKR)"
        note="CSV columns: Rate Group then one column per weight limit in kg. Prices in Sri Lankan Rupees are stored unchanged and re-converted on every update."
      >
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={rateInput}
            type="file"
            accept=".csv,text/csv"
            className="text-sm"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importRates.mutate(f);
              e.target.value = "";
            }}
          />
          {importRates.isPending && <span className="text-xs text-muted-foreground">Importing…</span>}
        </div>
        <IssueList issues={rateIssues} />

        {active && (
          <div className="overflow-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-3 font-normal text-xs uppercase tracking-[0.14em]">Rate group</th>
                  {active.weightLimits.map((w) => (
                    <th key={w} className="py-2 px-2 text-right font-normal text-xs uppercase tracking-[0.14em]">
                      ≤ {w} kg
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["RATE_GROUP_1", "RATE_GROUP_2", "RATE_GROUP_3", "RATE_GROUP_4"].map((g) => (
                  <tr key={g} className="border-b border-border/60">
                    <td className="py-2 pr-3 whitespace-nowrap">{g.replace("RATE_GROUP_", "Group ")}</td>
                    {active.weightLimits.map((w) => {
                      const row = active.rates.find(
                        (r) => r.rate_group === g && Math.abs(r.weight_limit_kg - w) < 1e-6,
                      );
                      return (
                        <td key={w} className="py-2 px-2 text-right tabular-nums">
                          <div>{row?.usd_rate != null ? `$${row.usd_rate.toFixed(2)}` : "—"}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {row ? `LKR ${row.lkr_rate.toFixed(2)}` : ""}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Rate tester" note="Checks a real city against the published prices.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.16em]">City</Label>
            <Input value={testCity} onChange={(e) => setTestCity(e.target.value)} placeholder="Galle, Galle" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.16em]">Weight (kg)</Label>
            <Input value={testWeight} onChange={(e) => setTestWeight(e.target.value)} className="w-28" />
          </div>
          <Button size="sm" disabled={runTest.isPending || !testCity.trim()} onClick={() => runTest.mutate()}>
            {runTest.isPending ? "Testing…" : "Test rate"}
          </Button>
        </div>
        {testResult && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <p>Matched city: {testResult.matchedCity ?? "no match"}</p>
            <p>Rate group: {testResult.rateGroup ?? "—"}</p>
            <p>Billable weight: {testResult.billableWeightKg?.toFixed(2) ?? "—"} kg</p>
            <p>Weight band: {testResult.weightLimitKg != null ? `≤ ${testResult.weightLimitKg} kg` : "—"}</p>
            <p>Price: {testResult.total != null ? `$${testResult.total.toFixed(2)}` : "—"}</p>
            {testResult.message && <p className="mt-2 text-muted-foreground">{testResult.message}</p>}
          </div>
        )}
      </Section>

      <Section title="Update history" note="Every import and recalculation is versioned; the newest successful one is live.">
        <div className="overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-[0.14em]">
                <th className="py-2 pr-3 font-normal">When</th>
                <th className="py-2 pr-3 font-normal">Trigger</th>
                <th className="py-2 pr-3 font-normal">By</th>
                <th className="py-2 pr-3 font-normal">Rate</th>
                <th className="py-2 pr-3 font-normal">Rounding</th>
                <th className="py-2 pr-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.history ?? []).map((h) => (
                <tr key={h.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(h.createdAt)}</td>
                  <td className="py-2 pr-3">{h.initiatedBy}</td>
                  <td className="py-2 pr-3">{h.actorLabel || "system"}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {h.exchangeRate ?? "—"}
                    {h.exchangeRateDate ? ` (${h.exchangeRateDate})` : ""}
                  </td>
                  <td className="py-2 pr-3">
                    {h.roundingMode === "decimals"
                      ? `${h.roundingSetting} dp`
                      : `USD ${h.roundingSetting}`}
                  </td>
                  <td className="py-2 pr-3">{h.status}</td>
                </tr>
              ))}
              {(data?.history ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-sm text-muted-foreground">
                    No updates yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-foreground/60">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
