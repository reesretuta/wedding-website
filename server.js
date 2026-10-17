'use strict';

/**
 * Zero-dependency static server for the wedding website.
 * Localhost unlocks Edit mode APIs (reorder / remove photos).
 *
 * Run:  node server.js
 * Open: http://localhost:4567/
 */

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT, 10) || 4567;
const PUBLIC = path.join(__dirname, 'public');
const PHOTOS_JSON = path.join(PUBLIC, 'photos.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function isLocalRequest(req) {
  const host = String(req.headers.host || '')
    .split(':')[0]
    .toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  const ra = req.socket && req.socket.remoteAddress;
  return ra === '127.0.0.1' || ra === '::1' || ra === '::ffff:127.0.0.1';
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 8 * 1024 * 1024) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleSavePhotos(req, res) {
  if (!isLocalRequest(req)) {
    return sendJSON(res, 403, { error: 'Edit mode is only available on localhost' });
  }
  let data;
  try {
    data = JSON.parse(await readBody(req));
  } catch (e) {
    return sendJSON(res, 400, { error: 'Invalid JSON' });
  }
  if (!Array.isArray(data.photos)) {
    return sendJSON(res, 400, { error: 'Expected { photos: [] }' });
  }

  let existing = {};
  try {
    existing = JSON.parse(await fsp.readFile(PHOTOS_JSON, 'utf8'));
  } catch (_) {}

  const photos = data.photos.map((p, i) => ({
    id: i + 1,
    file: String(p.file || ''),
    src: String(p.src || ''),
    original: String(p.original || p.file || ''),
  }));

  const out = {
    generatedAt: existing.generatedAt || null,
    updatedAt: new Date().toISOString(),
    coupleNames: existing.coupleNames || 'Claire & Rees',
    tagline: existing.tagline || '',
    dateLabel: existing.dateLabel || '',
    count: photos.length,
    photos,
  };

  try {
    await fsp.writeFile(PHOTOS_JSON, JSON.stringify(out, null, 2));
  } catch (e) {
    return sendJSON(res, 500, { error: e.message });
  }
  return sendJSON(res, 200, { ok: true, count: photos.length });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsed.pathname || '/');

    if (req.method === 'GET' && pathname === '/api/status') {
      return sendJSON(res, 200, { local: isLocalRequest(req) });
    }
    if (req.method === 'POST' && pathname === '/api/photos') {
      return handleSavePhotos(req, res);
    }

    if (pathname === '/') pathname = '/index.html';

    const filePath = path.normalize(path.join(PUBLIC, pathname));
    if (!filePath.startsWith(PUBLIC)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not found');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': ext.match(/\.(jpe?g|png|webp|gif)$/)
          ? 'public, max-age=86400'
          : 'no-cache',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (e) {
    sendJSON(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Wedding website running.');
  console.log('  Open: http://localhost:' + PORT + '/');
  console.log('  Local edit mode: available on localhost only');
  console.log('  (Press Ctrl+C to stop)');
  console.log('');
});
