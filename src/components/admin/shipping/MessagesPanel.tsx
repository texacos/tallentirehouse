import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useShippingMessages,
  useSaveShippingMessage,
  type ServiceStatus,
} from "@/lib/shipping-admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const STATUSES: { status: ServiceStatus; title: string; hint: string }[] = [
  {
    status: "no_rate",
    title: "No rate available",
    hint: "Shown when the destination is serviced but the order weight has no price.",
  },
  {
    status: "no_service",
    title: "No service",
    hint: "Shown when the carrier does not deliver to the destination at all.",
  },
];

export function MessagesPanel({ carrierId }: { carrierId: string }) {
  const { data: messages, isLoading } = useShippingMessages(carrierId);
  const save = useSaveShippingMessage();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!messages) return;
    const next: Record<string, string> = {};
    for (const s of STATUSES) {
      next[s.status] = messages.find((m) => m.status === s.status)?.body_html ?? "";
    }
    setDrafts(next);
  }, [messages]);


  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Simple HTML is allowed (paragraphs, links). These messages appear at checkout.
      </p>
      {STATUSES.map(({ status, title, hint }) => {
        const existing = messages?.find((m) => m.status === status);
        return (
          <div key={status} className="rounded-md border border-border p-5 space-y-3">
            <div>
              <h3 className="font-display text-xl">{title}</h3>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
            <Textarea
              rows={5}
              value={drafts[status] ?? ""}
              onChange={(e) => setDrafts({ ...drafts, [status]: e.target.value })}
              placeholder="<p>Please contact us for a shipping quote.</p>"
            />
            {drafts[status] ? (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Preview
                </p>
                <div
                  className="[&_p]:mt-2 [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: drafts[status] }}
                />
              </div>
            ) : null}
            <Button
              disabled={save.isPending}
              onClick={() =>
                save.mutate(
                  {
                    id: existing?.id,
                    carrier_id: carrierId,
                    status,
                    body_html: drafts[status] ?? "",
                  },
                  {
                    onSuccess: () => toast.success("Message saved."),
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              {save.isPending && <Loader2 className="animate-spin" />} Save message
            </Button>
          </div>
        );
      })}
    </div>
  );
}
