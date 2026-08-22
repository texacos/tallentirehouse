import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { adminListRates, adminRefreshRate } from "@/lib/currency.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/currencies")({
  head: () => ({
    meta: [
      { title: "Currencies — Admin — Tallentire House" },
      {
        name: "description",
        content:
          "Today's USD/LKR indicative exchange rate from the Central Bank of Sri Lanka, refreshed weekly.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CurrenciesAdmin,
});

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CurrenciesAdmin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const ratesQ = useQuery({
    queryKey: ["admin-currency-rates"],
    queryFn: () => adminListRates(),
    enabled: Boolean(user && isAdmin),
  });

  const refresh = useMutation({
    mutationFn: () => adminRefreshRate(),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Exchange rate updated");
        void qc.invalidateQueries({ queryKey: ["admin-currency-rates"] });
      } else {
        toast.error(res.error ?? "Could not fetch the rate");
      }
    },
    onError: () => toast.error("Could not fetch the rate"),
  });

  if (loading) {
    return <div className="mx-auto max-w-6xl px-6 py-20 text-sm">Loading…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-20 text-sm">
        You need admin access to view this page.
      </div>
    );
  }

  const rows = ratesQ.data?.rows ?? [];
  const latest = rows[0];

  return (
    <div className="mx-auto max-w-6xl px-6 lg:px-10 py-14">
      <p className="eyebrow text-foreground/60">Admin</p>
      <h1 className="mt-3 font-display text-4xl md:text-5xl">Currencies</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        The indicative USD/LKR spot rate published by the Central Bank of Sri
        Lanka. Fetched automatically every Monday at 10:00 Sri Lanka time.
      </p>
      <div className="mt-4 flex gap-4 text-sm">
        <Link to="/admin/products" className="underline underline-offset-4">
          Products dashboard
        </Link>
        <Link to="/admin/orders" className="underline underline-offset-4">
          Web Orders
        </Link>
        <Link to="/admin/shipping" className="underline underline-offset-4">
          Shipping dashboard
        </Link>
      </div>

      <div className="mt-8 rounded-md border border-border bg-muted/30 px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="eyebrow text-foreground/60">
              Today&rsquo;s Exchange Rate USD/LKR
            </p>
            <p className="mt-3 font-display text-5xl">
              {latest ? latest.rate.toFixed(4) : "—"}
              {latest && (
                <span className="ml-3 text-base text-muted-foreground">
                  LKR per 1 USD
                </span>
              )}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {latest
                ? `Rate date ${latest.rate_date} · fetched ${fmtDate(latest.fetched_at)} · source ${latest.source}`
                : "No rate stored yet — use Refresh now to fetch the current rate."}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            <RefreshCw
              size={16}
              className={refresh.isPending ? "animate-spin" : undefined}
            />
            {refresh.isPending ? "Fetching…" : "Refresh now"}
          </Button>
        </div>
      </div>

      {ratesQ.isError && (
        <p className="mt-6 text-sm text-red-700">
          Could not load stored rates. Please try again.
        </p>
      )}

      <h2 className="mt-12 font-display text-2xl">History</h2>
      <div className="mt-4 overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Rate date</th>
              <th className="px-4 py-3">1 USD → LKR</th>
              <th className="px-4 py-3">1 LKR → USD</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Fetched</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                  {ratesQ.isLoading ? "Loading…" : "No rates recorded yet."}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3">{r.rate_date}</td>
                <td className="px-4 py-3">{Number(r.rate).toFixed(4)}</td>
                <td className="px-4 py-3">
                  {r.inverse_rate ? Number(r.inverse_rate).toFixed(6) : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.source}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {fmtDate(r.fetched_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
