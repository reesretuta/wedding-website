'use strict';

const coupleEl = document.getElementById('coupleNames');
const taglineEl = document.getElementById('tagline');
const dateEl = document.getElementById('dateLabel');
const footerEl = document.getElementById('footerNames');
const grid = document.getElementById('grid');
const galleryCount = document.getElementById('galleryCount');
const empty = document.getElementById('empty');
const heroMedia = document.getElementById('heroMedia');

const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbCaption = document.getElementById('lbCaption');
const lbPrev = document.getElementById('lbPrev');
const lbNext = document.getElementById('lbNext');
const lbClose = document.getElementById('lbClose');

let photos = [];
let lbIndex = -1;

init();

async function init() {
  try {
    const res = await fetch('/photos.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('no manifest');
    const data = await res.json();
    applyMeta(data);
    photos = data.photos || [];
    if (!photos.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    galleryCount.textContent = `${photos.length} photographs`;
    setHero(photos[0]);
    renderGrid();
    observeTiles();
  } catch (_) {
    empty.hidden = false;
  }

  wireLightbox();
}

function applyMeta(data) {
  if (data.coupleNames) {
    coupleEl.textContent = data.coupleNames;
    footerEl.textContent = data.coupleNames;
    document.title = data.coupleNames;
  }
  if (data.tagline) taglineEl.textContent = data.tagline;
  dateEl.textContent = data.dateLabel || '';
}

function setHero(photo) {
  if (!photo) return;
  heroMedia.style.backgroundImage = `url("${photo.src}")`;
}

function renderGrid() {
  grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  photos.forEach((photo, i) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.dataset.index = String(i);
    tile.setAttribute('aria-label', `Photo ${i + 1}`);

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = photo.src;
    img.alt = '';
    tile.appendChild(img);

    tile.addEventListener('click', () => openLightbox(i));
    frag.appendChild(tile);
  });
  grid.appendChild(frag);
}

function observeTiles() {
  const tiles = grid.querySelectorAll('.tile');
  if (!('IntersectionObserver' in window)) {
    tiles.forEach((t) => t.classList.add('visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: '80px', threshold: 0.08 }
  );
  tiles.forEach((t) => io.observe(t));
}

function wireLightbox() {
  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click', () => showLightbox(lbIndex - 1));
  lbNext.addEventListener('click', () => showLightbox(lbIndex + 1));
  lbImg.addEventListener('click', () => showLightbox(lbIndex + 1));
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') showLightbox(lbIndex + 1);
    if (e.key === 'ArrowLeft') showLightbox(lbIndex - 1);
  });
}

function openLightbox(i) {
  lightbox.hidden = false;
  showLightbox(i);
}

function showLightbox(i) {
  if (!photos.length) return;
  lbIndex = (i + photos.length) % photos.length;
  const photo = photos[lbIndex];
  lbImg.src = photo.src;
  lbCaption.textContent = `${lbIndex + 1} / ${photos.length}`;
  preload(lbIndex + 1);
  preload(lbIndex - 1);
}

function preload(i) {
  if (!photos.length) return;
  const photo = photos[(i + photos.length) % photos.length];
  const im = new Image();
  im.src = photo.src;
}

function closeLightbox() {
  lightbox.hidden = true;
  lbImg.src = '';
  lbIndex = -1;
}
