'use strict';

/**
 * Prepare an extra gallery section from a folder of images. Skips videos.
 *
 * Run:
 *   node scripts/prepare-extra.js more [sourceDir]
 *   node scripts/prepare-extra.js photobooth [sourceDir]
 */

const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'site.config.json');
const IMAGE_RE = /\.(jpe?g|png|heic|webp|tif{1,2})$/i;

const SECTIONS = {
  more: {
    configDirKey: 'moreSourceDir',
    configTitleKey: 'moreTitle',
    defaultSrc: '/Users/claire/Downloads/wedding_website_friday',
    defaultTitle: 'Welcome drinks, After Party, Misc',
    slug: 'more',
  },
  photobooth: {
    configDirKey: 'photoboothSourceDir',
    configTitleKey: 'photoboothTitle',
    defaultSrc: '/Users/claire/Downloads/wedding_website_photobooth',
    defaultTitle: 'Photobooth',
    slug: 'photobooth',
  },
};

async function run(sectionKey, sourceDirArg) {
  const spec = SECTIONS[sectionKey];
  if (!spec) {
    console.error(`Unknown section "${sectionKey}". Use: ${Object.keys(SECTIONS).join(', ')}`);
    process.exit(1);
  }

  const config = JSON.parse(await fsp.readFile(CONFIG_PATH, 'utf8'));
  const sourceDir = path.resolve(
    sourceDirArg || config[spec.configDirKey] || spec.defaultSrc
  );
  const maxWidth = config.maxWidth || 2000;
  const quality = config.jpegQuality || 85;
  const title = config[spec.configTitleKey] || spec.defaultTitle;
  const outDir = path.join(ROOT, 'photos', spec.slug);
  const publicDir = path.join(ROOT, 'public', 'photos', spec.slug);
  const manifestPath = path.join(ROOT, 'public', `${spec.slug}.json`);

  let entries;
  try {
    entries = await fsp.readdir(sourceDir);
  } catch (e) {
    console.error(`Source folder missing: ${sourceDir}`);
    console.error('Create it and drop photos in, then re-run.');
    process.exit(1);
  }

  const names = entries
    .filter((n) => IMAGE_RE.test(n) && !n.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  if (!names.length) {
    console.error(`No images found in ${sourceDir}`);
    process.exit(1);
  }

  await fsp.mkdir(outDir, { recursive: true });
  await fsp.rm(publicDir, { recursive: true, force: true });
  await fsp.mkdir(publicDir, { recursive: true });

  console.log(`Section: ${sectionKey}`);
  console.log(`Source: ${sourceDir}`);
  console.log(`Images: ${names.length}`);
  console.log(`Title: ${title}`);
  console.log('');

  const photos = [];
  let done = 0;
  let failed = 0;

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const src = path.join(sourceDir, name);
    const outName = String(i + 1).padStart(3, '0') + '_' + sanitize(replaceExt(name, '.jpg'));
    const dest = path.join(outDir, outName);
    try {
      await convert(src, dest, maxWidth, quality);
      await fsp.copyFile(dest, path.join(publicDir, outName));
      photos.push({
        id: i + 1,
        file: outName,
        src: `photos/${spec.slug}/${outName}`,
        original: name,
      });
      done++;
      console.log(`  [${i + 1}/${names.length}] ${name}`);
    } catch (e) {
      failed++;
      console.warn(`  FAIL ${name}: ${e.message}`);
    }
  }

  await fsp.writeFile(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        title,
        count: photos.length,
        photos,
      },
      null,
      2
    ) + '\n'
  );

  console.log('');
  console.log(`Done. converted=${done} failed=${failed} total=${photos.length}`);
  console.log(`Manifest: ${manifestPath}`);
}

function sanitize(name) {
  return name.replace(/[^\w.\-]+/g, '_');
}

function replaceExt(name, ext) {
  return name.replace(/\.[^.]+$/, '') + ext;
}

async function convertViaQuickLook(src, dest, maxWidth, quality) {
  const thumbDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wedding-extra-'));
  try {
    await execFileAsync('qlmanage', ['-t', '-s', String(maxWidth), '-o', thumbDir, src], {
      timeout: 120000,
    });
    const pngs = (await fsp.readdir(thumbDir)).filter((n) => n.endsWith('.png'));
    if (!pngs.length) throw new Error('qlmanage produced no thumbnail');
    await ffmpegJpeg(path.join(thumbDir, pngs[0]), dest, maxWidth, quality);
  } finally {
    await fsp.rm(thumbDir, { recursive: true, force: true });
  }
}

async function convert(src, dest, maxWidth, quality) {
  const ext = path.extname(src).toLowerCase();
  const tmp = dest + '.tmp.jpg';
  if (ext === '.heic') {
    await convertViaQuickLook(src, tmp, maxWidth, quality);
  } else {
    try {
      await ffmpegJpeg(src, tmp, maxWidth, quality);
      if (await isNearlyBlack(tmp)) throw new Error('ffmpeg produced a black frame');
    } catch (_) {
      await convertViaQuickLook(src, tmp, maxWidth, quality);
    }
  }
  await fsp.rename(tmp, dest);
  if (await isNearlyBlack(dest)) {
    throw new Error('output is nearly black');
  }
}

async function isNearlyBlack(file) {
  try {
    const { stderr } = await execFileAsync(
      'ffmpeg',
      [
        '-i',
        file,
        '-vf',
        'signalstats,metadata=print:key=lavfi.signalstats.YAVG',
        '-f',
        'null',
        '-',
      ],
      { timeout: 60000 }
    );
    const m = String(stderr).match(/YAVG=([0-9.]+)/);
    if (!m) return false;
    return Number(m[1]) < 2;
  } catch (_) {
    return false;
  }
}

async function ffmpegJpeg(src, dest, maxWidth, quality) {
  const q = Math.max(2, Math.min(8, Math.round((100 - quality) / 5)));
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i',
      src,
      '-frames:v',
      '1',
      '-update',
      '1',
      '-vf',
      `scale='min(${maxWidth},iw)':-2`,
      '-q:v',
      String(q),
      dest,
    ],
    { timeout: 120000 }
  );
}

if (require.main === module) {
  const section = process.argv[2];
  const sourceDir = process.argv[3];
  if (!section) {
    console.error('Usage: node scripts/prepare-extra.js <more|photobooth> [sourceDir]');
    process.exit(1);
  }
  run(section, sourceDir).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { run, SECTIONS };
