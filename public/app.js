'use strict';

const coupleEl = document.getElementById('coupleNames');
const taglineEl = document.getElementById('tagline');
const dateEl = document.getElementById('dateLabel');
const footerEl = document.getElementById('footerNames');
const grid = document.getElementById('grid');
const editGrid = document.getElementById('editGrid');
const galleryCount = document.getElementById('galleryCount');
const empty = document.getElementById('empty');
const heroMedia = document.getElementById('heroMedia');

const filmsGrid = document.getElementById('filmsGrid');
const filmsTitle = document.getElementById('filmsTitle');
const filmsSubtitle = document.getElementById('filmsSubtitle');

const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbCaption = document.getElementById('lbCaption');
const lbPrev = document.getElementById('lbPrev');
const lbNext = document.getElementById('lbNext');
const lbClose = document.getElementById('lbClose');

const videoModal = document.getElementById('videoModal');
const videoFrame = document.getElementById('videoFrame');
const videoCaption = document.getElementById('videoCaption');
const videoClose = document.getElementById('videoClose');

const localBar = document.getElementById('localBar');
const viewModeBtn = document.getElementById('viewModeBtn');
const editModeBtn = document.getElementById('editModeBtn');
const editStatus = document.getElementById('editStatus');
const editHint = document.getElementById('editHint');

let photos = [];
let manifestMeta = {};
let lbIndex = -1;
let isLocal = false;
let mode = 'view'; // 'view' | 'edit'
let dragSrcIndex = -1;
let dragIndexes = []; // multi-select drag set (sorted ascending)
let selected = new Set(); // indexes selected in edit mode
let selectAnchor = -1;
let saveTimer = null;

init();

async function init() {
  isLocal = await checkLocal();
  if (isLocal) {
    localBar.hidden = false;
    document.body.classList.add('has-local-bar');
    viewModeBtn.addEventListener('click', () => setMode('view'));
    editModeBtn.addEventListener('click', () => setMode('edit'));
  }

  try {
    const res = await fetch('photos.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('no manifest');
    const data = await res.json();
    applyMeta(data);
    manifestMeta = data;
    photos = data.photos || [];
    refreshGallery();
  } catch (_) {
    empty.hidden = false;
  }

  await loadFilms();
  wireLightbox();
  wireVideoModal();
}

async function checkLocal() {
  try {
    const res = await fetch('api/status', { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.local;
  } catch (_) {
    return false;
  }
}

function setMode(next) {
  if (!isLocal) return;
  mode = next;
  viewModeBtn.classList.toggle('active', mode === 'view');
  editModeBtn.classList.toggle('active', mode === 'edit');
  if (editHint) editHint.hidden = mode !== 'edit';
  document.body.classList.toggle('edit-mode', mode === 'edit');
  closeLightbox();
  refreshGallery();
  if (mode === 'edit') {
    selected = new Set();
    selectAnchor = -1;
    updateEditStatus();
    const gallery = document.getElementById('gallery');
    if (gallery) {
      gallery.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else {
    selected = new Set();
    selectAnchor = -1;
    editStatus.textContent = '';
  }
}

function updateEditStatus() {
  const n = selected.size;
  editStatus.textContent =
    n > 0
      ? `${n} selected · ${photos.length} photos`
      : `${photos.length} photos · select then drag`;
}

function refreshGallery() {
  if (!photos.length) {
    empty.hidden = false;
    grid.hidden = true;
    editGrid.hidden = true;
    galleryCount.textContent = '';
    return;
  }
  empty.hidden = true;
  galleryCount.textContent =
    `${photos.length} photograph${photos.length === 1 ? '' : 's'}` +
    (mode === 'edit' ? ' · editing' : '');

  setHero(photos[0]);

  if (mode === 'edit' && isLocal) {
    grid.setAttribute('hidden', '');
    editGrid.removeAttribute('hidden');
    renderEditGrid();
  } else {
    editGrid.setAttribute('hidden', '');
    grid.removeAttribute('hidden');
    renderGrid();
    observeTiles();
  }
}

async function loadFilms() {
  try {
    const res = await fetch('videos.json', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.title) filmsTitle.textContent = data.title;
    if (data.subtitle) filmsSubtitle.textContent = data.subtitle;
    renderFilms(data.videos || []);
  } catch (_) {
    /* section stays empty */
  }
}

function renderFilms(videos) {
  filmsGrid.innerHTML = '';
  const frag = document.createDocumentFragment();
  videos.forEach((v) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'film';
    btn.setAttribute('aria-label', `Play ${v.title}`);

    const thumb = document.createElement('div');
    thumb.className = 'film-thumb';

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = '';
    img.src = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
    img.addEventListener('error', () => {
      img.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
    });
    thumb.appendChild(img);

    const play = document.createElement('span');
    play.className = 'film-play';
    play.setAttribute('aria-hidden', 'true');
    thumb.appendChild(play);

    const meta = document.createElement('div');
    meta.className = 'film-meta';
    const title = document.createElement('h3');
    title.className = 'film-title';
    title.textContent = v.title;
    title.title = v.title;
    meta.appendChild(title);
    if (v.duration) {
      const dur = document.createElement('p');
      dur.className = 'film-duration';
      dur.textContent = v.duration;
      meta.appendChild(dur);
    }

    btn.appendChild(thumb);
    btn.appendChild(meta);
    btn.addEventListener('click', () => openVideo(v));
    frag.appendChild(btn);
  });
  filmsGrid.appendChild(frag);
}

function wireVideoModal() {
  videoClose.addEventListener('click', closeVideo);
  videoModal.addEventListener('click', (e) => {
    if (e.target === videoModal) closeVideo();
  });
}

function openVideo(v) {
  closeLightbox();
  videoCaption.textContent = v.title;
  videoFrame.src = `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`;
  videoModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeVideo() {
  videoModal.hidden = true;
  videoFrame.src = '';
  document.body.style.overflow = '';
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

function renderEditGrid() {
  editGrid.innerHTML = '';
  const frag = document.createDocumentFragment();
  photos.forEach((photo, i) => {
    const tile = document.createElement('div');
    tile.className = 'edit-tile' + (selected.has(i) ? ' selected' : '');
    tile.draggable = true;
    tile.dataset.index = String(i);

    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = '';
    img.draggable = false;
    tile.appendChild(img);

    const badge = document.createElement('span');
    badge.className = 'edit-badge';
    badge.textContent = String(i + 1);
    tile.appendChild(badge);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'edit-remove';
    remove.setAttribute('aria-label', `Remove ${photo.original || photo.file}`);
    remove.textContent = '✕';
    remove.addEventListener('click', (e) => {
      e.stopPropagation();
      removePhotosAt(selected.has(i) && selected.size > 1 ? [...selected] : [i]);
    });
    tile.appendChild(remove);

    const name = document.createElement('span');
    name.className = 'edit-name';
    name.textContent = photo.original || photo.file;
    tile.appendChild(name);

    tile.addEventListener('click', (e) => onEditTileClick(e, i));
    attachEditDrag(tile);
    frag.appendChild(tile);
  });
  editGrid.appendChild(frag);
  updateEditStatus();
}

function onEditTileClick(e, index) {
  if (e.shiftKey && selectAnchor >= 0) {
    const [lo, hi] =
      selectAnchor < index ? [selectAnchor, index] : [index, selectAnchor];
    selected = new Set();
    for (let i = lo; i <= hi; i++) selected.add(i);
  } else if (e.metaKey || e.ctrlKey) {
    if (selected.has(index)) selected.delete(index);
    else selected.add(index);
    selectAnchor = index;
  } else {
    selected = new Set([index]);
    selectAnchor = index;
  }
  syncEditSelectionUI();
  updateEditStatus();
}

function syncEditSelectionUI() {
  editGrid.querySelectorAll('.edit-tile').forEach((t) => {
    const i = Number(t.dataset.index);
    t.classList.toggle('selected', selected.has(i));
  });
}

function attachEditDrag(tile) {
  tile.addEventListener('dragstart', (e) => {
    const idx = Number(tile.dataset.index);

    if (!selected.has(idx)) {
      selected = new Set([idx]);
      selectAnchor = idx;
      syncEditSelectionUI();
    }

    dragIndexes = [...selected].sort((a, b) => a - b);
    dragSrcIndex = idx;

    editGrid.querySelectorAll('.edit-tile').forEach((t) => {
      if (selected.has(Number(t.dataset.index))) t.classList.add('dragging');
    });

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragIndexes.join(','));
    updateEditStatus();
  });

  tile.addEventListener('dragend', () => {
    editGrid.querySelectorAll('.edit-tile').forEach((t) =>
      t.classList.remove('dragging', 'drop-before', 'drop-after')
    );
    dragSrcIndex = -1;
    dragIndexes = [];
  });

  tile.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const idx = Number(tile.dataset.index);
    if (dragIndexes.includes(idx)) return;
    const rect = tile.getBoundingClientRect();
    const after = e.clientX > rect.left + rect.width / 2;
    tile.classList.toggle('drop-after', after);
    tile.classList.toggle('drop-before', !after);
  });

  tile.addEventListener('dragleave', () => {
    tile.classList.remove('drop-before', 'drop-after');
  });

  tile.addEventListener('drop', (e) => {
    e.preventDefault();
    tile.classList.remove('drop-before', 'drop-after');
    const toIndex = Number(tile.dataset.index);
    if (!dragIndexes.length || dragIndexes.includes(toIndex)) return;
    const rect = tile.getBoundingClientRect();
    const after = e.clientX > rect.left + rect.width / 2;
    movePhotos(dragIndexes, toIndex, after);
  });
}

function movePhotos(indexes, toIndex, placeAfter) {
  const movingSet = new Set(indexes);
  if (movingSet.has(toIndex)) return;

  const moving = indexes
    .slice()
    .sort((a, b) => a - b)
    .map((i) => photos[i]);
  const rest = photos.filter((_, i) => !movingSet.has(i));

  let insertAt = 0;
  for (let i = 0; i < photos.length; i++) {
    if (i === toIndex) break;
    if (!movingSet.has(i)) insertAt++;
  }
  if (placeAfter) insertAt += 1;
  insertAt = Math.max(0, Math.min(rest.length, insertAt));

  rest.splice(insertAt, 0, ...moving);
  photos = rest;

  selected = new Set();
  for (let i = 0; i < moving.length; i++) selected.add(insertAt + i);
  selectAnchor = insertAt;

  refreshGallery();
  scheduleSave();
}

function removePhotosAt(indexes) {
  const uniq = [...new Set(indexes)].sort((a, b) => a - b);
  if (!uniq.length) return;
  const label =
    uniq.length === 1
      ? `Remove “${photos[uniq[0]].original || photos[uniq[0]].file}” from the gallery?`
      : `Remove ${uniq.length} selected photos from the gallery?`;
  if (!confirm(label)) return;
  const drop = new Set(uniq);
  photos = photos.filter((_, i) => !drop.has(i));
  selected = new Set();
  selectAnchor = -1;
  refreshGallery();
  scheduleSave();
}

function scheduleSave() {
  if (!isLocal) return;
  editStatus.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(savePhotos, 400);
}

async function savePhotos() {
  try {
    const res = await fetch('api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Save failed');
    photos = photos.map((p, i) => ({ ...p, id: i + 1 }));
    const n = selected.size;
    editStatus.textContent =
      n > 0
        ? `Saved · ${n} selected · ${photos.length} photos`
        : `Saved · ${photos.length} photos`;
  } catch (err) {
    editStatus.textContent = 'Save failed';
    console.error(err);
  }
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
    if (!videoModal.hidden) {
      if (e.key === 'Escape') closeVideo();
      return;
    }
    if (mode === 'edit' && isLocal) {
      if (e.key === 'Escape') {
        selected = new Set();
        selectAnchor = -1;
        syncEditSelectionUI();
        updateEditStatus();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selected = new Set(photos.map((_, i) => i));
        selectAnchor = photos.length ? 0 : -1;
        syncEditSelectionUI();
        updateEditStatus();
        return;
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selected.size) {
        e.preventDefault();
        removePhotosAt([...selected]);
        return;
      }
    }
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') showLightbox(lbIndex + 1);
    if (e.key === 'ArrowLeft') showLightbox(lbIndex - 1);
  });
}

function openLightbox(i) {
  if (mode === 'edit') return;
  closeVideo();
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
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
  if (videoModal.hidden) document.body.style.overflow = '';
}
