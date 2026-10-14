# Wedding website

A static wedding gallery site that uses your **custom photo sort order** from
`custom-sort-order-app` and serves web-optimized JPEGs.

## Setup (once)

1. Edit names / copy in `site.config.json` if you want.
2. Prepare web photos from your sorted folder:

```bash
cd "/Volumes/rees claire/FINAL_WEDDING_PICS_ALL/wedding-website"
node scripts/prepare-photos.js
```

This reads the order JSON, resizes with macOS `sips` (max ~2000px), and writes:

- `photos/web/` — optimized images
- `public/photos.json` — gallery manifest
- `public/photos/` — symlink to web images

Re-run prepare anytime you change the order or replace photos (it caches).

## Run locally

```bash
node server.js
```

Open **http://localhost:4567/**

## Notes

- `start*.png` marker files and Screenshots are skipped by default (see `site.config.json`).
- Original full-res files stay in your wedding folder; only web copies are generated here.
- Deploy later to Cloudflare Pages + R2 (or any static host) by uploading `public/`.
