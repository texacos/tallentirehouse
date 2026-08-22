import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { finalizeCheckout, type OrderSummary } from "@/lib/checkout.functions";
import { formatPrice } from "@/lib/products";
import { useCart } from "@/lib/cart";

export const Route = createFileRoute("/checkout/return")({
  head: () => ({
    meta: [
      { title: "Order status — Tallentire House" },
      { name: "description", content: "Your Tallentire House order confirmation." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutReturnPage,
});

function CheckoutReturnPage() {
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { clear } = useCart();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderNumber = params.get("order") ?? "";
    if (!orderNumber) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void finalizeCheckout({ data: { orderNumber } })
      .then((res) => {
        if (cancelled) return;
        setSummary(res);
        if (res?.status === "paid") clear();
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-32 text-center">
        <p className="eyebrow text-foreground/60">Please wait</p>
        <h1 className="mt-4 font-display text-4xl">Confirming your payment…</h1>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-32 text-center">
        <h1 className="font-display text-4xl">Order not found</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          We couldn't find that order. If you were charged, contact
          info@tallentirehouse.com with your payment reference.
        </p>
        <Link
          to="/shop"
          className="mt-8 inline-block border border-foreground px-8 py-4 text-xs uppercase tracking-[0.22em]"
        >
          Back to the shop
        </Link>
      </div>
    );
  }

  const paid = summary.status === "paid";

  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="eyebrow text-foreground/60">
        {paid ? "Thank you" : summary.status === "pending" ? "Pending" : "Payment not completed"}
      </p>
      <h1 className="mt-4 font-display text-5xl">
        {paid
          ? "Your order is confirmed"
          : summary.status === "pending"
            ? "We're still awaiting confirmation"
            : "Your payment didn't go through"}
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Order <strong>{summary.orderNumber}</strong>
        {summary.isTest && " · test mode"}
      </p>

      <div className="mt-10 border border-border p-6 text-left">
        <ul className="space-y-2 text-sm">
          {summary.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-4">
              <span>
                {i.name}
                {i.size ? ` · ${i.size}` : ""} × {i.qty}
              </span>
              <span className="tabular-nums">{formatPrice(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="my-4 rule" />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatPrice(summary.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Shipping{summary.carrierName ? ` · ${summary.carrierName}` : ""}
          </span>
          <span className="tabular-nums">{formatPrice(summary.shipping)}</span>
        </div>
        <div className="mt-2 flex justify-between text-base">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(summary.total)}</span>
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-4">
        <Link
          to="/shop"
          className="inline-block bg-foreground text-background px-8 py-4 text-xs uppercase tracking-[0.22em]"
        >
          Continue shopping
        </Link>
        {!paid && (
          <Link
            to="/cart"
            className="inline-block border border-foreground px-8 py-4 text-xs uppercase tracking-[0.22em]"
          >
            Back to basket
          </Link>
        )}
      </div>
    </div>
  );
}
