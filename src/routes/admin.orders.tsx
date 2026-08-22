import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  adminListOrders,
  adminResendOrderEmail,
  adminSetTestMode,
  adminUpdateOrder,
  type AdminOrder,
  type OrderFilters,
} from "@/lib/orders.functions";
import { formatPrice } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "Web Orders — Admin — Tallentire House" },
      {
        name: "description",
        content: "Manage web orders, payment status, fulfilment and test mode.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrdersAdmin,
});

const STATUSES = ["all", "pending", "paid", "failed", "cancelled", "refunded"] as const;
const FULFILMENT = ["new", "processing", "shipped", "completed"] as const;

function statusTone(status: string) {
  if (status === "paid") return "bg-emerald-100 text-emerald-900";
  if (status === "pending") return "bg-amber-100 text-amber-900";
  if (status === "failed" || status === "cancelled") return "bg-red-100 text-red-900";
  return "bg-muted text-foreground";
}

function OrdersAdmin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [filters, setFilters] = useState<OrderFilters>({
    search: "",
    status: "all",
    mode: "all",
    from: "",
    to: "",
    page: 1,
    pageSize: 25,
  });
  const [searchDraft, setSearchDraft] = useState("");
  const [openOrder, setOpenOrder] = useState<AdminOrder | null>(null);

  useEffect(() => {
    const t = setTimeout(
      () => setFilters((f) => ({ ...f, search: searchDraft, page: 1 })),
      300,
    );
    return () => clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const ordersQ = useQuery({
    queryKey: ["admin-orders", filters],
    queryFn: () => adminListOrders({ data: filters }),
    enabled: Boolean(user && isAdmin),
  });

  const setMode = useMutation({
    mutationFn: (test: boolean) => adminSetTestMode({ data: { test } }),
    onSuccess: () => {
      toast.success("Payment mode updated");
      void qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: () => toast.error("Could not change the payment mode"),
  });

  const update = useMutation({
    mutationFn: (input: Parameters<typeof adminUpdateOrder>[0]["data"]) =>
      adminUpdateOrder({ data: input }),
    onSuccess: () => {
      toast.success("Order updated");
      void qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: () => toast.error("Could not update the order"),
  });

  const resend = useMutation({
    mutationFn: (id: string) => adminResendOrderEmail({ data: { id } }),
    onSuccess: () => toast.success("Confirmation email re-sent"),
    onError: () => toast.error("Could not send the email"),
  });

  const rows = ordersQ.data?.rows ?? [];
  const total = ordersQ.data?.total ?? 0;
  const stats = ordersQ.data?.stats;
  const testMode = ordersQ.data?.testMode ?? true;
  const pages = Math.max(1, Math.ceil(total / filters.pageSize));

  const csv = useMemo(() => {
    const head = [
      "order_number",
      "created_at",
      "mode",
      "status",
      "fulfilment",
      "customer",
      "email",
      "country",
      "carrier",
      "subtotal",
      "shipping",
      "total",
    ];
    const lines = rows.map((o) =>
      [
        o.order_number,
        o.created_at,
        o.is_test ? "test" : "live",
        o.status,
        o.fulfilment_status,
        o.customer_name,
        o.email,
        o.delivery_address?.["country"] ?? "",
        o.shipping_carrier_name,
        o.subtotal,
        o.shipping_amount,
        o.total,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    return [head.join(","), ...lines].join("\n");
  }, [rows]);

  function downloadCsv() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `web-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-20 text-sm text-muted-foreground">Loading…</div>
    );
  }
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="font-display text-3xl">Admin role required</h1>
        <Link to="/" className="mt-6 inline-block">
          <Button variant="outline">Back to shop</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 lg:px-10 py-14">
      <p className="eyebrow text-foreground/60">Admin</p>
      <h1 className="mt-3 font-display text-4xl md:text-5xl">Web Orders</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Every order placed through the shop, with its payment status, fulfilment
        progress and whether it was taken in test or live mode.
      </p>
      <div className="mt-4 flex gap-4 text-sm">
        <Link to="/admin/products" className="underline underline-offset-4">
          Products dashboard
        </Link>
        <Link to="/admin/shipping" className="underline underline-offset-4">
          Shipping dashboard
        </Link>
      </div>

      {/* Payment mode */}
      <div className="mt-8 flex flex-wrap items-center gap-4 rounded-md border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <Switch
            id="test-mode"
            checked={testMode}
            onCheckedChange={(v) => setMode.mutate(Boolean(v))}
            disabled={setMode.isPending || ordersQ.isLoading}
          />
          <Label htmlFor="test-mode" className="text-sm">
            Payment test mode {testMode ? "on" : "off"}
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          {testMode
            ? "New orders are sent to the payment provider with test=true — no real money is charged."
            : "Live mode: real cards are charged."}
        </p>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Orders today" value={String(stats?.ordersToday ?? "—")} />
        <Stat
          label="Paid this month"
          value={stats ? formatPrice(stats.paidRevenueMonth) : "—"}
        />
        <Stat label="Awaiting payment" value={String(stats?.pendingCount ?? "—")} />
      </div>

      {/* Filters */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="Search order, name or email"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          className="lg:col-span-2"
        />
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={filters.mode}
          onChange={(e) =>
            setFilters((f) => ({ ...f, mode: e.target.value as OrderFilters["mode"], page: 1 }))
          }
        >
          <option value="all">Test and live</option>
          <option value="live">Live only</option>
          <option value="test">Test only</option>
        </select>
        <Button variant="outline" onClick={downloadCsv} disabled={rows.length === 0}>
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.14em]">
            <tr>
              <th className="px-3 py-3">Order</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Fulfilment</th>
              <th className="px-3 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {ordersQ.isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Loading orders…
                </td>
              </tr>
            )}
            {!ordersQ.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No orders yet.
                </td>
              </tr>
            )}
            {rows.map((o) => (
              <tr
                key={o.id}
                className="border-t border-border hover:bg-muted/30 cursor-pointer"
                onClick={() => setOpenOrder(o)}
              >
                <td className="px-3 py-3">
                  <span className="font-medium">{o.order_number}</span>
                  {o.is_test && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      TEST
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-3">
                  <div className="line-clamp-1">{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{o.email}</div>
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded px-2 py-1 text-xs ${statusTone(o.status)}`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{o.fulfilment_status}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatPrice(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} order{total === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={filters.page <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
          >
            Previous
          </Button>
          <span>
            {filters.page} / {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={filters.page >= pages}
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
          >
            Next
          </Button>
        </div>
      </div>

      <OrderSheet
        order={openOrder}
        onClose={() => setOpenOrder(null)}
        onSave={(patch) => update.mutate(patch)}
        onResend={(id) => resend.mutate(id)}
        saving={update.isPending}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}

function OrderSheet({
  order,
  onClose,
  onSave,
  onResend,
  saving,
}: {
  order: AdminOrder | null;
  onClose: () => void;
  onSave: (patch: {
    id: string;
    fulfilment_status?: (typeof FULFILMENT)[number];
    internal_note?: string;
    tracking_number?: string;
  }) => void;
  onResend: (id: string) => void;
  saving: boolean;
}) {
  const [fulfilment, setFulfilment] = useState<(typeof FULFILMENT)[number]>("new");
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState("");

  useEffect(() => {
    if (!order) return;
    setFulfilment((order.fulfilment_status as (typeof FULFILMENT)[number]) ?? "new");
    setNote(order.internal_note ?? "");
    setTracking(order.tracking_number ?? "");
  }, [order]);

  if (!order) return null;
  const addr = (a: Record<string, string> | null | undefined) =>
    [a?.["name"], a?.["line1"], a?.["line2"], a?.["city"], a?.["region"], a?.["postcode"], a?.["country"]]
      .filter(Boolean)
      .join(", ");

  return (
    <Sheet open={Boolean(order)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">
            {order.order_number} {order.is_test && <Badge variant="outline">TEST</Badge>}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6 text-sm">
          <div className="flex flex-wrap gap-3">
            <span className={`rounded px-2 py-1 text-xs ${statusTone(order.status)}`}>
              {order.status}
            </span>
            <span className="text-muted-foreground">
              {new Date(order.created_at).toLocaleString()}
            </span>
          </div>

          <div>
            <h3 className="font-medium">Items</h3>
            <ul className="mt-2 space-y-1">
              {order.items?.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-3">
                  <span>
                    {i.product_name}
                    {i.size ? ` · ${i.size}` : ""} × {i.qty}
                    <span className="ml-2 text-xs text-muted-foreground">{i.sku}</span>
                  </span>
                  <span className="tabular-nums">{formatPrice(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-border pt-3">
              <Row label="Subtotal" value={formatPrice(order.subtotal)} />
              <Row
                label={`Shipping · ${order.shipping_carrier_name || "—"}`}
                value={formatPrice(order.shipping_amount)}
              />
              <Row label="Weight" value={`${order.total_weight_kg} kg`} />
              <Row label="Total" value={formatPrice(order.total)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="font-medium">Billing</h3>
              <p className="mt-1 text-muted-foreground">{addr(order.billing_address)}</p>
            </div>
            <div>
              <h3 className="font-medium">Delivery</h3>
              <p className="mt-1 text-muted-foreground">{addr(order.delivery_address)}</p>
            </div>
            <div>
              <h3 className="font-medium">Contact</h3>
              <p className="mt-1 text-muted-foreground">
                {order.email}
                {order.phone ? ` · ${order.phone}` : ""}
              </p>
            </div>
            <div>
              <h3 className="font-medium">Payment reference</h3>
              <p className="mt-1 break-all text-muted-foreground">
                {order.payment_intent_id ?? "—"}
              </p>
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.18em]">Fulfilment</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={fulfilment}
                onChange={(e) =>
                  setFulfilment(e.target.value as (typeof FULFILMENT)[number])
                }
              >
                {FULFILMENT.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.18em]">Tracking number</Label>
              <Input value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.18em]">Internal note</Label>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={saving}
                onClick={() =>
                  onSave({
                    id: order.id,
                    fulfilment_status: fulfilment,
                    internal_note: note,
                    tracking_number: tracking,
                  })
                }
              >
                Save changes
              </Button>
              <Button variant="outline" onClick={() => onResend(order.id)}>
                Re-send confirmation email
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Email status: {order.email_status}
              {order.email_error ? ` (${order.email_error})` : ""}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
