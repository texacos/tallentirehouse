# Fix the share preview image on Our Story

## What's happening

The Our Story page currently tells social platforms (WhatsApp, Facebook, LinkedIn, X) to use the old hero interior photo as its share image. That image no longer appears anywhere on the page, so shared links look disconnected from the content.

## The change

Point the page's share image at the first photo on the page — the early Kutch visit (Lindsay among the drying block-printed cloths). This is a metadata-only change; nothing visible on the page moves or changes.

## Technical detail

In `src/routes/about.tsx`, inside the route's `head()`:

- Replace the `og:image` and `twitter:image` values, which currently use `heroInterior`, with the absolute URL of the 1440-wide JPEG derivative of the Kutch early-visit photo (`kutch-early-visit-w1440.jpg`), built as `${SITE}${asset.url}` exactly as now.
- Add `og:image:width` / `og:image:height` (1440 x 810) so platforms render the large-card layout reliably.
- Keep JPEG (not WebP) — some crawlers still don't handle WebP previews.
- Remove the now-unused `heroInterior` import if nothing else on the page uses it.

Title, description, canonical, and og:url stay exactly as they are.

## After it ships

WhatsApp and other platforms cache the preview they last scraped, so the old image may keep showing for a while on links already shared. New shares pick up the new image once the page is published; a forced refresh is possible via each platform's link preview debugger (e.g. Facebook Sharing Debugger).
