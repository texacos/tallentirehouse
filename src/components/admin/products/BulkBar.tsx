import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Copy, Download, Trash2, X } from "lucide-react";
import {
  PRODUCT_STATUSES,
  STATUS_LABEL,
  type BulkAction,
} from "@/lib/admin-products.types";

type Pending =
  | { kind: "confirm"; action: BulkAction; title: string; body: string }
  | { kind: "price" }
  | { kind: "inventory" }
  | { kind: "tags"; mode: "add" | "remove" }
  | { kind: "brand" }
  | null;

export function BulkBar({
  count,
  total,
  allMatchingSelected,
  onSelectAllMatching,
  onClear,
  onRun,
  onExportSelection,
  busy,
}: {
  count: number;
  total: number;
  allMatchingSelected: boolean;
  onSelectAllMatching: () => void;
  onClear: () => void;
  onRun: (action: BulkAction) => void;
  onExportSelection: () => void;
  busy: boolean;
}) {
  const [pending, setPending] = useState<Pending>(null);
  const [priceForm, setPriceForm] = useState({
    field: "price" as "price" | "sale_price",
    mode: "set" as "set" | "increase" | "decrease",
    unit: "amount" as "amount" | "percent",
    value: "0",
  });
  const [invForm, setInvForm] = useState({
    mode: "set" as "set" | "increase" | "decrease",
    value: "0",
  });
  const [tagsInput, setTagsInput] = useState("");
  const [brandInput, setBrandInput] = useState("");

  if (count === 0) return null;

  const close = () => setPending(null);
  const run = (action: BulkAction) => {
    onRun(action);
    close();
  };

  return (
    <>
      <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-md border border-foreground/20 bg-card px-4 py-3 shadow-lg">
        <span className="text-sm">
          <strong className="tabular-nums">{count}</strong> selected
        </span>
        {!allMatchingSelected && total > count && (
          <Button variant="link" size="sm" onClick={onSelectAllMatching}>
            Select all {total} matching
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={busy}>
              Status <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Set status</DropdownMenuLabel>
            {PRODUCT_STATUSES.map((s) => (
              <DropdownMenuItem key={s} onClick={() => onRun({ type: "status", status: s })}>
                {STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={busy}>
              Edit <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setPending({ kind: "price" })}>
              Update price…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPending({ kind: "inventory" })}>
              Adjust inventory…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPending({ kind: "brand" })}>
              Change design…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setPending({ kind: "tags", mode: "add" })}>
              Add tags…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPending({ kind: "tags", mode: "remove" })}>
              Remove tags…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() =>
            setPending({
              kind: "confirm",
              action: { type: "duplicate" },
              title: `Duplicate ${count} product${count === 1 ? "" : "s"}?`,
              body: "Copies are created as drafts with a “-copy” slug.",
            })
          }
        >
          <Copy /> Duplicate
        </Button>

        <Button variant="outline" size="sm" disabled={busy} onClick={onExportSelection}>
          <Download /> Export
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          className="text-destructive"
          onClick={() =>
            setPending({
              kind: "confirm",
              action: { type: "delete" },
              title: `Delete ${count} product${count === 1 ? "" : "s"}?`,
              body: "They disappear from the shop immediately. You can undo from the toast that follows.",
            })
          }
        >
          <Trash2 /> Delete
        </Button>

        <Button variant="ghost" size="sm" onClick={onClear} aria-label="Clear selection">
          <X /> Clear
        </Button>
      </div>

      <AlertDialog open={pending?.kind === "confirm"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "confirm" ? pending.title : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "confirm" ? pending.body : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pending?.kind === "confirm" && run(pending.action)}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending?.kind === "price"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update price on {count} products</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <Label>Field</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={priceForm.field}
                onChange={(e) =>
                  setPriceForm({ ...priceForm, field: e.target.value as "price" })
                }
              >
                <option value="price">Regular price</option>
                <option value="sale_price">Sale price</option>
              </select>
            </label>
            <label className="text-sm">
              <Label>Mode</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={priceForm.mode}
                onChange={(e) =>
                  setPriceForm({ ...priceForm, mode: e.target.value as "set" })
                }
              >
                <option value="set">Set to</option>
                <option value="increase">Increase by</option>
                <option value="decrease">Decrease by</option>
              </select>
            </label>
            <label className="text-sm">
              <Label>Unit</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={priceForm.unit}
                disabled={priceForm.mode === "set"}
                onChange={(e) =>
                  setPriceForm({ ...priceForm, unit: e.target.value as "amount" })
                }
              >
                <option value="amount">USD</option>
                <option value="percent">Percent</option>
              </select>
            </label>
            <label className="text-sm">
              <Label>Value</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={priceForm.value}
                onChange={(e) => setPriceForm({ ...priceForm, value: e.target.value })}
                className="mt-1"
              />
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                run({
                  type: "price",
                  field: priceForm.field,
                  mode: priceForm.mode,
                  unit: priceForm.unit,
                  value: Math.max(0, Number(priceForm.value) || 0),
                })
              }
            >
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending?.kind === "inventory"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adjust inventory on {count} products</AlertDialogTitle>
            <AlertDialogDescription>
              Variable products have every variant adjusted by the same amount.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <Label>Mode</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={invForm.mode}
                onChange={(e) => setInvForm({ ...invForm, mode: e.target.value as "set" })}
              >
                <option value="set">Set to</option>
                <option value="increase">Increase by</option>
                <option value="decrease">Decrease by</option>
              </select>
            </label>
            <label className="text-sm">
              <Label>Units</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={invForm.value}
                onChange={(e) => setInvForm({ ...invForm, value: e.target.value })}
                className="mt-1"
              />
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                run({
                  type: "inventory",
                  mode: invForm.mode,
                  value: Math.max(0, Math.trunc(Number(invForm.value) || 0)),
                })
              }
            >
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending?.kind === "tags"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "tags" && pending.mode === "add" ? "Add" : "Remove"} tags
            </AlertDialogTitle>
            <AlertDialogDescription>Comma-separated list of tags.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="handwoven, gift, summer"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const tags = tagsInput
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .slice(0, 20);
                if (!tags.length) return close();
                run(
                  pending?.kind === "tags" && pending.mode === "add"
                    ? { type: "addTags", tags }
                    : { type: "removeTags", tags },
                );
                setTagsInput("");
              }}
            >
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending?.kind === "brand"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change design on {count} products</AlertDialogTitle>
          </AlertDialogHeader>
          <Input
            value={brandInput}
            onChange={(e) => setBrandInput(e.target.value)}
            placeholder="e.g. Indigo Block Print"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => run({ type: "brand", brand: brandInput.trim() })}
            >
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
