import { useEffect } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { AdminProduct } from "@/lib/admin-products.types";

export type PaletteCommand = { id: string; label: string; run: () => void };

export function CommandPalette({
  open,
  onOpenChange,
  products,
  commands,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: AdminProduct[];
  commands: PaletteCommand[];
  onPick: (p: AdminProduct) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search products or run a command…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Commands">
          {commands.map((c) => (
            <CommandItem
              key={c.id}
              onSelect={() => {
                c.run();
                onOpenChange(false);
              }}
            >
              {c.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Products on this page">
          {products.slice(0, 40).map((p) => (
            <CommandItem
              key={p.id}
              value={`${p.name} ${p.sku} ${p.slug}`}
              onSelect={() => {
                onPick(p);
                onOpenChange(false);
              }}
            >
              <span className="truncate">{p.name}</span>
              {p.sku && (
                <span className="ml-auto text-xs text-muted-foreground">{p.sku}</span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
