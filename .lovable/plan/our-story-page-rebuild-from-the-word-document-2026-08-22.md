# Our Story page — rebuild from the Word document

Replace everything on `/about` below the existing eyebrow ("Our story"), heading, and the intro line "A small studio, in love with slow things." with the content of `Tallentire_House_Our_Story_revised.docx`, presented as one continuous scrolling page in the current site style. The intro line remains immediately under the heading, before the new Word-document content begins.

## Page structure (continuous, no page breaks)

Eyebrow + heading (kept as-is), the existing intro line "A small studio, in love with slow things." (kept as-is), then eight sections in document order:

1. Opening image — caption "Kutch, one of the early visits." + pull quote "Colour, cloth, craftsmanship — and the people you meet along the way."
2. It began in Kutch — image "My first visit to Kutch, 1997."
3. Learning through making — pull quote "For me, designing has always happened in the making." + two images (indigo vat, artisan washing fabric), shared caption "Indigo, washing and dyeing: the process is part of the design."
4. Design through collaboration — two images, caption "Shamji Vankar weaving and checking one of Lindsay's bedspread designs in Bhujodi, Kutch."
5. From loom to finished piece — image "The finished handwoven bedspread in Sri Lanka." + pull quote "Traditional skill does not have to mean traditional design."
6. A language of many crafts — two images, caption "Hand embroidery in progress, and a finished Tallentire House design."
7. The clothing — image "Lindsay and Fiona Taylor wearing handwoven cloth developed with the weavers of Kutch."
8. Tallentire House today — closing pull quote "Buy less, buy better." + existing "Shop the collection" button.

The repeated "TALLENTIRE HOUSE" footer line from the document is dropped (it is a print footer, not content).

Styling reuses existing tokens: `font-display` headings, `eyebrow` for section labels, `rule` dividers, clay accent for pull quotes, cream background, generous vertical rhythm matching the current About page.

## Images

Nothing from the Word file is used. Until you upload the real photos, each slot renders a soft placeholder block with the correct aspect ratio and its caption, so layout and copy can be reviewed immediately. When you upload, each file is pushed to the CDN and responsive derivatives are generated at 480 / 960 / 1440 / 1920 px in WebP + JPEG, served through a `<picture>` with `srcset`/`sizes`, lazy-loaded below the fold, with width/height set to avoid layout shift. Captions double as alt-text seeds (alt text refined per image for accessibility/SEO).

### Best upload size

- Full-width / feature images (opening, bedspread, clothing): **2400 × 1600 px** landscape (3:2), JPEG quality ~90, sRGB.
- Paired images (indigo/washing, weaving, embroidery): **1800 × 1800 px** square or **1800 × 1200** landscape — but keep each pair consistent with each other.
- Max 8 MB per file, JPEG or PNG, no logos or text baked in.

Naming: use the caption, lower-case with hyphens, e.g. `kutch-early-visit.jpg`, `first-visit-kutch-1997.jpg`, `indigo-vat.jpg`, `washing-fabric.jpg`, `shamji-vankar-weaving.jpg`, `bedspread-triangle-check.jpg`, `bedspread-sri-lanka.jpg`, `hand-embroidery.jpg`, `butterfly-cushion-desert.jpg`, `lindsay-fiona-handwoven.jpg`.

## What else to plan

- Images are fixed in code for now (uploaded as CDN assets and referenced directly in the page); admin-managed swapping can be added later as a follow-up.
- Head/SEO: new page title, description, og:title/og:description, og:type "article", self-referencing canonical and og:url, plus og:image and twitter:image pointing at the opening photo once uploaded.
- The page keeps the URL `/about` (footer link "Our story" stays pointing there).

## Technical notes

- Single file change: `src/routes/about.tsx`, plus a small `StorySection`/`StoryFigure` presentation component if it keeps the route readable.
- Images go through Lovable Assets (`.asset.json` pointers) so no binaries land in the repo; derivative widths generated at upload time.
- No database or backend changes.
