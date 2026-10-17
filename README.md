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

- `photos/web/` — working cache
- `public/photos.json` — gallery manifest
- `public/photos/` — web images (deployed)

Re-run prepare anytime you change the order or replace photos (it caches).
Gallery edits from local Edit mode are preserved when possible.

## Run locally

```bash
node server.js
```

Open **http://localhost:4567/**

### Local Edit mode (localhost only)

When the site is opened via `localhost`, a **View / Edit** bar appears at the top:

- **View** — normal gallery (what guests see)
- **Edit** — multi-select, drag to reorder, ✕ to remove; auto-saves `public/photos.json`

Edit mode does **not** appear on GitHub Pages (no Node API there).

## Deploy to GitHub Pages (free)

This repo is set up to deploy the `public/` folder automatically.

### 1. Create a GitHub repo and push

```bash
cd "/Volumes/rees claire/FINAL_WEDDING_PICS_ALL/wedding-website"

# If you don't have `gh` yet:
#   brew install gh
#   gh auth login

gh repo create wedding-website --public --source=. --remote=origin --push
```

Or create an empty repo on github.com named `wedding-website`, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/wedding-website.git
git push -u origin main
```

### 2. Turn on Pages

1. GitHub → your repo → **Settings** → **Pages**
2. **Source**: GitHub Actions
3. Wait for the **Deploy GitHub Pages** workflow (Actions tab) to finish

Your site will be at:

`https://YOUR_USERNAME.github.io/wedding-website/`

### After you edit photos locally

```bash
git add -A
git commit -m "Update gallery"
git push
```

Pages redeploys on every push to `main`.

## Videos

Wedding films live in `public/videos.json` (YouTube IDs + titles).

## Notes

- `start*.png` marker files and Screenshots are skipped by default (see `site.config.json`).
- Original full-res files stay in your wedding folder; only web copies are deployed (~125 MB).
- Do **not** commit full-resolution originals — only `public/photos/`.
