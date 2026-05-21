import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trash2, Plus, X } from "lucide-react";
import { z } from "zod";
import { CATEGORIES, formatPrice, type Product } from "@/lib/products";
import {
  addCustomProduct,
  deleteCustomProduct,
  slugify,
  useCustomProducts,
} from "@/lib/customProducts";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  sku: z.string().trim().max(40).optional().or(z.literal("")),
  price: z.coerce.number().int().min(0, "Price must be 0 or more"),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  categories: z.array(z.string().min(1)).min(1, "Pick at least one category"),
  images: z.array(z.string().trim().min(1)).min(1, "Add at least one image URL"),
});

export const Route = createFileRoute("/admin/products")({
  head: () => ({
    meta: [
      { title: "Manage products — Tallentire House" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminProductsPage,
});

function AdminProductsPage() {
  const custom = useCustomProducts();
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-20 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <p className="eyebrow text-foreground/60">Access denied</p>
        <h1 className="mt-3 font-display text-3xl">Admin role required</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account doesn't have admin privileges. Ask an existing admin to grant you access.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/"><Button variant="outline">Back to shop</Button></Link>
          <Button variant="ghost" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>Sign out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 lg:px-10 py-14">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="eyebrow text-foreground/60">Admin</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl">Your products</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg">
            Manually created pieces are stored in your browser and appear alongside
            the catalog throughout the shop.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? "outline" : "default"}>
          {showForm ? <X /> : <Plus />}
          {showForm ? "Cancel" : "New product"}
        </Button>
      </div>

      {showForm && (
        <div className="mt-10 border border-border p-6 lg:p-8 bg-card">
          <NewProductForm onCreated={() => setShowForm(false)} />
        </div>
      )}

      <div className="mt-12 rule" />

      <h2 className="mt-10 font-display text-2xl">
        Custom products
        <span className="ml-2 text-foreground/40 tabular-nums text-base">{custom.length}</span>
      </h2>

      {custom.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          You haven't added any products yet. Click <em>New product</em> to create one.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {custom.map((p) => (
            <li key={p.slug} className="flex items-center gap-4 py-4">
              <div className="h-16 w-16 shrink-0 bg-muted overflow-hidden">
                {p.images[0] && (
                  <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  to="/product/$slug"
                  params={{ slug: p.slug }}
                  className="font-medium hover:underline underline-offset-4"
                >
                  {p.name}
                </Link>
                <p className="text-xs text-muted-foreground truncate">
                  {p.sku ? `${p.sku} · ` : ""}
                  {p.categories.join(", ")}
                </p>
              </div>
              <div className="text-sm tabular-nums">{formatPrice(p.price)}</div>
              <button
                aria-label={`Delete ${p.name}`}
                onClick={() => {
                  if (confirm(`Delete "${p.name}"?`)) {
                    deleteCustomProduct(p.slug);
                    toast.success("Product deleted");
                  }
                }}
                className="p-2 text-foreground/60 hover:text-destructive transition"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewProductForm({ onCreated }: { onCreated: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([""]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sortedCategories = useMemo(
    () => [...CATEGORIES].sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function toggleCat(c: string) {
    setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function setImage(i: number, value: string) {
    setImages((prev) => prev.map((img, idx) => (idx === i ? value : img)));
  }
  function addImageField() {
    setImages((prev) => [...prev, ""]);
  }
  function removeImageField(i: number) {
    setImages((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanedImages = images.map((s) => s.trim()).filter(Boolean);
    const result = productSchema.safeParse({
      name,
      slug,
      sku,
      price,
      description,
      categories: cats,
      images: cleanedImages,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString() ?? "form";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    const product: Product = {
      slug: result.data.slug,
      name: result.data.name,
      sku: result.data.sku ?? "",
      price: result.data.price,
      description: result.data.description ?? "",
      categories: result.data.categories,
      images: result.data.images,
    };
    try {
      addCustomProduct(product);
      toast.success("Product created");
      onCreated();
      navigate({ to: "/product/$slug", params: { slug: product.slug } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create product";
      setErrors({ slug: message });
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Field label="Name" error={errors.name}>
          <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Feather Cushion – Juniper" maxLength={160} />
        </Field>
        <Field label="Slug" error={errors.slug} hint="Used in the product URL">
          <Input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            placeholder="feather-cushion-juniper"
            maxLength={120}
          />
        </Field>
        <Field label="SKU (optional)" error={errors.sku}>
          <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="CF01" maxLength={40} />
        </Field>
        <Field label="Price (LKR)" error={errors.price}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="10500"
          />
        </Field>
      </div>

      <Field label="Description" error={errors.description}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          maxLength={4000}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Tell the story of this piece…"
        />
      </Field>

      <Field label="Categories" error={errors.categories} hint={`${cats.length} selected`}>
        <div className="max-h-56 overflow-y-auto border border-border rounded-md p-3 grid grid-cols-2 md:grid-cols-3 gap-1.5">
          {sortedCategories.map((c) => {
            const checked = cats.includes(c.slug);
            return (
              <label
                key={c.slug}
                className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded cursor-pointer ${
                  checked ? "bg-accent text-accent-foreground" : "hover:bg-accent/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCat(c.slug)}
                  className="accent-foreground"
                />
                <span className="truncate">{c.label}</span>
              </label>
            );
          })}
        </div>
      </Field>

      <Field label="Image URLs" error={errors.images} hint="Paste hosted image URLs (or paths under /products/...)">
        <div className="space-y-2">
          {images.map((img, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={img}
                onChange={(e) => setImage(i, e.target.value)}
                placeholder="https://… or /products/my-item/0.jpg"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeImageField(i)}
                disabled={images.length === 1}
                aria-label="Remove image"
              >
                <X />
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={addImageField}>
            <Plus /> Add image
          </Button>
        </div>
      </Field>

      <div className="flex justify-end gap-3">
        <Button type="submit">Create product</Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label className="text-xs uppercase tracking-[0.18em] text-foreground/70">{label}</Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
