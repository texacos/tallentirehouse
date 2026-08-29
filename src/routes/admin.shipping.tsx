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
import { AramexDomesticPanel } from "@/components/admin/shipping/AramexDomesticPanel";
import { ARAMEX_DOMESTIC_CODE } from "@/lib/aramex-domestic";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  useSiteSettings,
  useUpdateSiteSetting,
  DEFAULT_SHIPPING_NOTE,
} from "@/lib/site-settings";


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
  const { productShippingNote } = useSiteSettings();
  const updateSetting = useUpdateSiteSetting();
  const [noteDraft, setNoteDraft] = useState(productShippingNote);
  useEffect(() => setNoteDraft(productShippingNote), [productShippingNote]);
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

      <div className="mt-8 max-w-2xl space-y-2 rounded-md border border-border bg-muted/30 px-4 py-3">
        <Label htmlFor="shipping-note" className="text-sm">
          Shipping note shown on every in-stock product page
        </Label>
        <Textarea
          id="shipping-note"
          rows={2}
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder={DEFAULT_SHIPPING_NOTE}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={updateSetting.isPending || noteDraft === productShippingNote}
            onClick={() =>
              updateSetting.mutate(
                { key: "product_shipping_note", value: noteDraft },
                {
                  onSuccess: () => toast.success("Shipping note saved"),
                  onError: () => toast.error("Could not save the note"),
                },
              )
            }
          >
            Save note
          </Button>
          <Button size="sm" variant="outline" onClick={() => setNoteDraft(DEFAULT_SHIPPING_NOTE)}>
            Reset to default
          </Button>
        </div>
      </div>

      {carriers.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
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
          <p className="text-xs text-muted-foreground">
            Country rules, rate groups, surcharges, messages and CSV import/export below apply
            only to {activeCarrier?.name ?? "the selected carrier"}.
          </p>
        </div>
      )}

      <Tabs defaultValue="carriers" className="mt-10">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="carriers">{activeCarrier?.name ?? "Carriers"}</TabsTrigger>
          {activeCarrier?.code === ARAMEX_DOMESTIC_CODE && (
            <TabsTrigger value="aramex-domestic">Cities &amp; LKR rates</TabsTrigger>
          )}
          <TabsTrigger value="countries">Country rules</TabsTrigger>
          <TabsTrigger value="rates">Rate groups</TabsTrigger>
          <TabsTrigger value="surcharges">Surcharges</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="import">Import / Export</TabsTrigger>
          <TabsTrigger value="tester">Rate tester</TabsTrigger>
        </TabsList>

        {activeCarrier?.code === ARAMEX_DOMESTIC_CODE && (
          <TabsContent value="aramex-domestic" className="mt-6">
            <AramexDomesticPanel />
          </TabsContent>
        )}


        <TabsContent value="carriers" className="mt-6">
          <CarriersPanel selectedId={activeCarrier?.id} onSelect={setCarrierId} />
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
              <ImportExportPanel carrierId={activeCarrier.id} carrierName={activeCarrier.name} carrierCode={activeCarrier.code} />
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
