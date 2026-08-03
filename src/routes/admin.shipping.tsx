import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCarriers } from "@/lib/shipping-admin";
import { CarriersPanel } from "@/components/admin/shipping/CarriersPanel";
import { CountryRulesPanel } from "@/components/admin/shipping/CountryRulesPanel";
import { RateGroupsPanel } from "@/components/admin/shipping/RateGroupsPanel";
import { SurchargesPanel } from "@/components/admin/shipping/SurchargesPanel";
import { MessagesPanel } from "@/components/admin/shipping/MessagesPanel";
import { ImportExportPanel } from "@/components/admin/shipping/ImportExportPanel";
import { RateTesterPanel } from "@/components/admin/shipping/RateTesterPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [carrierId, setCarrierId] = useState<string | null>(null);
  const activeCarrier =
    carriers.find((c) => c.id === carrierId) ??
    carriers.find((c) => c.is_default) ??
    carriers[0];

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

      {carriers.length > 1 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.16em] text-foreground/70">Carrier</span>
          {carriers.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={c.id === activeCarrier?.id ? "default" : "outline"}
              onClick={() => setCarrierId(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      )}

      <Tabs defaultValue="carriers" className="mt-10">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="carriers">Carriers</TabsTrigger>
          <TabsTrigger value="countries">Country rules</TabsTrigger>
          <TabsTrigger value="rates">Rate groups</TabsTrigger>
          <TabsTrigger value="surcharges">Surcharges</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="import">Import / Export</TabsTrigger>
          <TabsTrigger value="tester">Rate tester</TabsTrigger>
        </TabsList>

        <TabsContent value="carriers" className="mt-6">
          <CarriersPanel selectedId={activeCarrier?.id} />
        </TabsContent>

        {!activeCarrier ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Create a carrier first — every other panel belongs to one.
          </p>
        ) : (
          <>
            <TabsContent value="countries" className="mt-6">
              <CountryRulesPanel carrierId={activeCarrier.id} />
            </TabsContent>
            <TabsContent value="rates" className="mt-6">
              <RateGroupsPanel carrierId={activeCarrier.id} />
            </TabsContent>
            <TabsContent value="surcharges" className="mt-6">
              <SurchargesPanel carrierId={activeCarrier.id} />
            </TabsContent>
            <TabsContent value="messages" className="mt-6">
              <MessagesPanel carrierId={activeCarrier.id} />
            </TabsContent>
            <TabsContent value="import" className="mt-6">
              <ImportExportPanel carrierId={activeCarrier.id} />
            </TabsContent>
            <TabsContent value="tester" className="mt-6">
              <RateTesterPanel carrier={activeCarrier} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );

}
