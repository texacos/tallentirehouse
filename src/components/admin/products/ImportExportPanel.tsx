import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Upload, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  CSV_COLUMNS,
  autoMap,
  downloadCsv,
  errorReportCsv,
  parseCsv,
  toCsv,
  validateRows,
  type CsvColumn,
  type FieldMap,
  type RowResult,
} from "@/lib/admin-products-csv";
import { useExportProducts, useImportProducts } from "@/lib/admin-products-client";
import type { ListFilters } from "@/lib/admin-products.types";

export function ImportExportPanel({ filters }: { filters: ListFilters }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [map, setMap] = useState<FieldMap>({});
  const [results, setResults] = useState<RowResult[] | null>(null);
  const importer = useImportProducts();
  const exporter = useExportProducts();

  const valid = results?.filter((r) => r.ok) ?? [];
  const invalid = results?.filter((r) => !r.ok) ?? [];

  async function onFile(file: File) {
    const text = await file.text();
    const preview = parseCsv(text);
    if (!preview.rows.length) {
      toast.error("That CSV appears to be empty");
      return;
    }
    setHeaders(preview.headers);
    setRows(preview.rows);
    const m = autoMap(preview.headers);
    setMap(m);
    setResults(validateRows(preview.rows, m));
  }

  function revalidate(next: FieldMap) {
    setMap(next);
    setResults(validateRows(rows, next));
  }

  async function runImport() {
    const products = valid
      .filter((r): r is Extract<RowResult, { ok: true }> => r.ok)
      .map((r) => r.product);
    if (!products.length) {
      toast.error("Nothing valid to import");
      return;
    }
    try {
      const res = await importer.mutateAsync(products);
      toast.success(`Imported: ${res.created} created, ${res.updated} updated`);
      setRows([]);
      setHeaders([]);
      setResults(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  }

  async function runExport() {
    try {
      const products = await exporter.mutateAsync(filters);
      if (!products.length) {
        toast.error("No products match the current filters");
        return;
      }
      downloadCsv(toCsv(products), `products-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`Exported ${products.length} products`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }

  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload /> Choose CSV
        </Button>
        <Button variant="outline" onClick={() => void runExport()} disabled={exporter.isPending}>
          {exporter.isPending ? <Loader2 className="animate-spin" /> : <Download />}
          Export current filter
        </Button>
        <p className="text-xs text-muted-foreground">
          Matching products are updated by slug; new slugs are created.
        </p>
      </div>

      {headers.length > 0 && (
        <>
          <div>
            <Label className="text-xs">Field mapping</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CSV_COLUMNS.map((col) => (
                <label key={col} className="flex items-center gap-2 text-xs">
                  <span className="w-32 shrink-0 truncate text-muted-foreground">{col}</span>
                  <select
                    className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-xs"
                    value={map[col] ?? ""}
                    aria-label={`CSV column for ${col}`}
                    onChange={(e) =>
                      revalidate({ ...map, [col as CsvColumn]: e.target.value || undefined })
                    }
                  >
                    <option value="">— ignore —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-emerald-600 dark:text-emerald-400">
              {valid.length} row{valid.length === 1 ? "" : "s"} ready
            </span>
            {invalid.length > 0 && (
              <>
                <span className="text-destructive">{invalid.length} with errors</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv(errorReportCsv(results ?? []), "import-errors.csv")
                  }
                >
                  <FileWarning /> Download error report
                </Button>
              </>
            )}
            <Button
              size="sm"
              onClick={() => void runImport()}
              disabled={importer.isPending || valid.length === 0}
            >
              {importer.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
              Import {valid.length} rows
            </Button>
          </div>

          {invalid.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded border border-border bg-background p-3 text-xs text-muted-foreground">
              {invalid.slice(0, 20).map((r) => (
                <li key={r.index}>
                  Row {r.index + 2}: {!r.ok && r.error}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
