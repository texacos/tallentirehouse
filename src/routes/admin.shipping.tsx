import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useCarriers } from "@/lib/shipping-admin";
import { CarriersPanel } from "@/components/admin/shipping/CarriersPanel";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/shipping")({
  head: () => ({
    meta: [
      { title: "Shipping — Admin — Tallentire House" },
      { name: "description", content: "Manage carriers, rate tables, country rules and surcharges." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ShippingAdmin,
});

function ShippingAdmin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { data: carriers = [] } = useCarriers();
  const defaultCarrier = carriers.find((c) => c.is_default) ?? carriers[0];

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-20 text-sm text-muted-foreground">Loading…</div>;
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
      <h1 className="mt-3 font-display text-4xl md:text-5xl">Shipping</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Carriers, rate tables, country rules, surcharges and messages — all
        carrier-agnostic, so a second courier can be added at any time.
      </p>
      <div className="mt-4">
        <Link to="/admin/products" className="text-sm underline underline-offset-4">
          Go to products dashboard
        </Link>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-2xl mb-4">Carriers</h2>
        <CarriersPanel selectedId={defaultCarrier?.id} />
      </div>
    </div>
  );
}
