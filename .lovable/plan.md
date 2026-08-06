# Products Dashboard — Professional Rebuild

Rebuild Admin → Products into a fast, keyboard-friendly product management system in the style of Shopify Admin / Linear / Stripe, keeping the current Tallentire House branding.

The full brief is large, so it is delivered in five phases. Each phase ships working software; you can stop or reorder at any point.

## Phase 1 — Data foundation

Extend the product database so the new fields the brief needs actually exist:

- Status (draft / published / hidden / archived / scheduled) + publish date
- Sale price, cost price, barcode, brand, supplier, collection, tags
- Reorder level, track-inventory flag, backorders, location
- Per-variant: colour, material, weight, volume, length, custom attributes, barcode, images
- Image alt text
- Audit log table (who / what / when, incl. login, price and stock changes, bulk ops)
- Product revision history table with rollback
- Saved filter presets and favourites per admin user

All writes go through server functions that re-verify the admin role, validate with Zod, and record an audit entry. Existing products keep working (status defaults to published).

## Phase 2 — Product list

- Modern data table: image, name, SKU, category, price, sale price, stock, stock status, status, visibility, last updated, actions
- Column picker (persisted per user)
- Instant search across name, SKU, barcode, category, description, tags, brand
- Combinable filters: category, brand, collection, supplier, stock status, status, price range, inventory level, created/updated date
- Sorting on all listed fields; pagination at 25/50/100/250/500
- Coloured stock indicators (green / orange / red / grey)
- Row quick-edit and edit icon
- Summary cards: total, active, draft, out of stock, low stock, inventory value, average price, newest, recently updated

## Phase 3 — Bulk actions and safety

- Multi-select with select-all-matching-filter
- Publish, unpublish, archive, delete, change category/brand, add/remove tags, update price, update sale price, adjust inventory, duplicate, export
- Confirmation dialogs for destructive and bulk operations
- Undo for price, inventory, delete and bulk edits (toast-level undo backed by the audit log)

## Phase 4 — Product editor

Tabbed editor (General, Inventory, Pricing, Shipping, Images, SEO, Variants, History):

- Autosave with dirty-state guard before navigating away
- Images: drag & drop, multi-upload, reorder, crop, alt text, WebP + thumbnail generation, lazy loading, MIME/extension/size validation
- Inventory: SKU, barcode, quantity, reorder level, location, backorders, tracking, stock history
- Pricing: regular, sale, cost, currency, computed margin and markup
- Variants: size/colour/material/weight/volume/length/custom attributes with their own images, SKU, barcode, price, stock, weight; clone variants
- SEO tab; History tab with diff view and rollback

## Phase 5 — Scale, polish, extras

- Virtualised rows and background/lazy loading so 50k products stay smooth
- Indexed, server-side filtered/paginated queries
- CSV import with field mapping, pre-import validation and downloadable error report; CSV export of current selection or filter
- Keyboard shortcuts and a command palette
- Nested categories with drag-and-drop organisation; tag autocomplete, creation and merge
- Barcode generator, low-stock alerts, recently viewed, favourites, saved filter presets
- Accessibility pass: labels, ARIA, focus rings, 44px targets, contrast

## Technical notes

- Reads move from "load all products" to a server-side paginated/filtered query via `createServerFn`, keyed with TanStack Query; the storefront keeps its existing lightweight read path.
- Every mutation is a server function guarded by the admin role check, with Zod validation on both client and server; no raw SQL string building.
- Uploads stay in the private image bucket and are served through the existing signed proxy, never the public root.
- Errors surface as generic user-facing messages; details stay in server logs.
- Components split under `src/components/admin/products/` with strongly typed props and memoised rows to minimise re-renders.
