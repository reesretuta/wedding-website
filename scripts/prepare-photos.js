'use strict';

/**
 * Read the custom sort-order JSON, resize photos with macOS `sips`,
 * and write photos/web/ + public/photos.json for the wedding site.
 *
 * Run:  node scripts/prepare-photos.js
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'site.config.json');
const OUT_DIR = path.join(ROOT, 'photos', 'web');
const MANIFEST_PATH = path.join(ROOT, 'public', 'photos.json');
const CACHE_PATH = path.join(ROOT, 'photos', '.prepare-cache.json');

async function main() {
  const config = JSON.parse(await fsp.readFile(CONFIG_PATH, 'utf8'));
  const orderPath = path.resolve(ROOT, config.sourceOrderFile);
  const orderData = JSON.parse(await fsp.readFile(orderPath, 'utf8'));
  const sourceDir = orderData.dir;
  const skipRe = new RegExp(config.skipNamePattern || '^$', 'i');

  let names = (orderData.order || []).filter((n) => !skipRe.test(n));
  if (config.skipScreenshots) {
    names = names.filter((n) => !/^Screenshot /i.test(n));
  }

  await fsp.mkdir(OUT_DIR, { recursive: true });
  await fsp.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  let cache = {};
  try {
    cache = JSON.parse(await fsp.readFile(CACHE_PATH, 'utf8'));
  } catch (_) {}

  const photos = [];
  let done = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`Source: ${sourceDir}`);
  console.log(`Photos to prepare: ${names.length}`);
  console.log(`Output: ${OUT_DIR}`);
  console.log('');

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const src = path.join(sourceDir, name);
    const base = String(i + 1).padStart(3, '0') + '_' + sanitize(name);
    const outName = replaceExt(base, '.jpg');
    const dest = path.join(OUT_DIR, outName);

    let stat;
    try {
      stat = await fsp.stat(src);
    } catch (e) {
      console.warn(`  skip missing: ${name}`);
      failed++;
      continue;
    }

    const key = `${name}|${stat.size}|${Math.round(stat.mtimeMs)}`;
    const cached = cache[name];
    let outStat;
    try {
      outStat = await fsp.stat(dest);
    } catch (_) {
      outStat = null;
    }

    if (cached === key && outStat && outStat.size > 0) {
      skipped++;
    } else {
      try {
        await convert(src, dest, config.maxWidth || 2000, config.jpegQuality || 85);
        cache[name] = key;
        done++;
        process.stdout.write(`  [${i + 1}/${names.length}] ${name}\n`);
      } catch (e) {
        console.warn(`  FAIL ${name}: ${e.message}`);
        failed++;
        continue;
      }
    }

    photos.push({
      id: i + 1,
      file: outName,
      src: `photos/${outName}`,
      original: name,
    });
  }

  // Prefer existing gallery edits (order / removals) from photos.json when present.
  const byOriginal = new Map(photos.map((p) => [p.original, p]));
  let ordered = photos;
  try {
    const existing = JSON.parse(await fsp.readFile(MANIFEST_PATH, 'utf8'));
    if (Array.isArray(existing.photos) && existing.photos.length) {
      const kept = [];
      const seen = new Set();
      for (const p of existing.photos) {
        const hit = byOriginal.get(p.original);
        if (hit && !seen.has(hit.original)) {
          kept.push(hit);
          seen.add(hit.original);
        }
      }
      for (const p of photos) {
        if (!seen.has(p.original)) kept.push(p);
      }
      ordered = kept;
      console.log(`Preserved gallery edits: ${kept.length} photos (from existing photos.json)`);
    }
  } catch (_) {
    /* first run — no existing manifest */
  }

  ordered = ordered.map((p, i) => ({ ...p, id: i + 1 }));

  await fsp.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
  await fsp.writeFile(
    MANIFEST_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        coupleNames: config.coupleNames,
        tagline: config.tagline,
        dateLabel: config.dateLabel || '',
        count: ordered.length,
        photos: ordered,
      },
      null,
      2
    )
  );

  // Copy web photos into public/photos (real files — needed for GitHub Pages)
  const publicPhotos = path.join(ROOT, 'public', 'photos');
  await fsp.rm(publicPhotos, { recursive: true, force: true });
  await fsp.cp(OUT_DIR, publicPhotos, { recursive: true });

  console.log('');
  console.log(
    `Done. converted=${done} cached=${skipped} failed=${failed} total=${ordered.length}`
  );
  console.log(`Manifest: ${MANIFEST_PATH}`);
}

function sanitize(name) {
  return name.replace(/[^\w.\-]+/g, '_');
}

function replaceExt(name, ext) {
  return name.replace(/\.[^.]+$/, '') + ext;
}

async function convert(src, dest, maxWidth, quality) {
  const tmp = dest + '.tmp.jpg';
  await execFileAsync(
    'sips',
    [
      '-s',
      'format',
      'jpeg',
      '-s',
      'formatOptions',
      String(quality),
      '-Z',
      String(maxWidth),
      src,
      '--out',
      tmp,
    ],
    { timeout: 120000 }
  );
  await fsp.rename(tmp, dest);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
