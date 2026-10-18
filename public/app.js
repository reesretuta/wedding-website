'use strict';

const coupleEl = document.getElementById('coupleNames');
const taglineEl = document.getElementById('tagline');
const dateEl = document.getElementById('dateLabel');
const footerEl = document.getElementById('footerNames');
const grid = document.getElementById('grid');
const editGrid = document.getElementById('editGrid');
const galleryCount = document.getElementById('galleryCount');
const empty = document.getElementById('empty');
const moreSection = document.getElementById('more');
const moreTitle = document.getElementById('moreTitle');
const moreCount = document.getElementById('moreCount');
const moreGrid = document.getElementById('moreGrid');
const photoboothSection = document.getElementById('photobooth');
const photoboothTitle = document.getElementById('photoboothTitle');
const photoboothCount = document.getElementById('photoboothCount');
const photoboothGrid = document.getElementById('photoboothGrid');
const sectionNav = document.getElementById('sectionNav');
const navMore = document.getElementById('navMore');
const navPhotobooth = document.getElementById('navPhotobooth');
const hero = document.getElementById('hero');
const heroMedia = document.getElementById('heroMedia');
const heroVideoWrap = document.getElementById('heroVideoWrap');
const heroPlayBtn = document.getElementById('heroPlayBtn');

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
const videoFrameMount = document.getElementById('videoFrameMount');
const videoCaption = document.getElementById('videoCaption');
const videoClose = document.getElementById('videoClose');

/** Official wedding film used as muted hero background. */
const HERO_VIDEO_TITLE = 'Official Wedding Video';
let heroFilm = null;
let heroBgActive = false;
let heroPlayer = null;
let modalPlayer = null;
let captionKillTimer = null;
let ytApiPromise = null;
let heroUnlockArmed = false;

const localBar = document.getElementById('localBar');
const viewModeBtn = document.getElementById('viewModeBtn');
const editModeBtn = document.getElementById('editModeBtn');
const editStatus = document.getElementById('editStatus');
const editHint = document.getElementById('editHint');

let photos = [];
let morePhotos = [];
let photoboothPhotos = [];
let manifestMeta = {};
let lbIndex = -1;
let lbList = [];
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

  await loadExtraGallery({
    url: 'more.json',
    sectionEl: moreSection,
    titleEl: moreTitle,
    countEl: moreCount,
    gridEl: moreGrid,
    setPhotos: (list) => {
      morePhotos = list;
    },
    getPhotos: () => morePhotos,
    label: 'More photo',
    navEl: navMore,
  });
  await loadExtraGallery({
    url: 'photobooth.json',
    sectionEl: photoboothSection,
    titleEl: photoboothTitle,
    countEl: photoboothCount,
    gridEl: photoboothGrid,
    setPhotos: (list) => {
      photoboothPhotos = list;
    },
    getPhotos: () => photoboothPhotos,
    label: 'Photobooth photo',
    navEl: navPhotobooth,
  });
  await loadFilms();
  wireSectionNav();
  wireLightbox();
  wireVideoModal();
}

async function loadExtraGallery({
  url,
  sectionEl,
  titleEl,
  countEl,
  gridEl,
  setPhotos,
  getPhotos,
  label,
  navEl,
}) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const list = data.photos || [];
    setPhotos(list);
    if (!list.length || !sectionEl) return;
    if (data.title && titleEl) titleEl.textContent = data.title;
    if (countEl) {
      countEl.textContent = `${list.length} photograph${list.length === 1 ? '' : 's'}`;
    }
    sectionEl.hidden = false;
    if (navEl) navEl.hidden = false;
    renderExtraGrid(gridEl, getPhotos, label);
  } catch (_) {
    /* optional section */
  }
}

function setActiveSectionNav(sectionId) {
  if (!sectionNav) return;
  sectionNav.querySelectorAll('.cta[data-section]').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.section === sectionId);
  });
}

function wireSectionNav() {
  if (!sectionNav) return;

  sectionNav.querySelectorAll('a.cta[data-section]').forEach((link) => {
    link.addEventListener('click', () => {
      setActiveSectionNav(link.dataset.section);
    });
  });

  const targets = [...sectionNav.querySelectorAll('a.cta[data-section]')]
    .map((link) => document.getElementById(link.dataset.section))
    .filter((el) => el && !el.hidden);

  if (!targets.length || !('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (!visible.length) return;
      setActiveSectionNav(visible[0].target.id);
    },
    { rootMargin: '-35% 0px -45% 0px', threshold: [0.1, 0.25, 0.5] }
  );
  targets.forEach((el) => io.observe(el));
}

function renderExtraGrid(gridEl, getPhotos, label) {
  if (!gridEl) return;
  const list = getPhotos();
  gridEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  list.forEach((photo, i) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.setAttribute('aria-label', `${label} ${i + 1}`);

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = photo.src;
    img.alt = '';
    tile.appendChild(img);

    tile.addEventListener('click', () => openLightbox(i, list));
    frag.appendChild(tile);
  });
  gridEl.appendChild(frag);
  observeTilesIn(gridEl);
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
    const videos = data.videos || [];
    renderFilms(videos);
    setupHeroVideo(videos);
  } catch (_) {
    /* section stays empty */
  }
}

function setupHeroVideo(videos) {
  heroFilm =
    videos.find((v) => v.title === HERO_VIDEO_TITLE) ||
    videos[0] ||
    null;
  if (!heroFilm || !heroVideoWrap) return;

  hero.classList.add('has-video');
  heroPlayBtn.hidden = false;
  heroPlayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openVideo(heroFilm);
  });
  hero.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    openVideo(heroFilm);
  });
  startHeroBackground();
}

function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

function disableCaptions(player) {
  if (!player) return;
  try {
    player.unloadModule('captions');
  } catch (_) { /* ignore */ }
  try {
    player.setOption('captions', 'track', {});
  } catch (_) { /* ignore */ }
  try {
    player.setOption('captions', 'reload', true);
  } catch (_) { /* ignore */ }
}

/** Captions often load a beat after play — keep killing them briefly. */
function keepCaptionsOff(player, ms = 4000) {
  disableCaptions(player);
  if (captionKillTimer) clearInterval(captionKillTimer);
  const start = Date.now();
  captionKillTimer = setInterval(() => {
    disableCaptions(player);
    if (Date.now() - start > ms) {
      clearInterval(captionKillTimer);
      captionKillTimer = null;
    }
  }, 400);
}

function forceHeroPlay() {
  if (!heroPlayer || !heroBgActive) return;
  try {
    heroPlayer.mute();
    heroPlayer.playVideo();
  } catch (_) { /* ignore */ }
}

/** iOS/Safari often blocks muted iframe autoplay until a gesture. */
function armHeroPlaybackUnlock() {
  if (heroUnlockArmed) return;
  heroUnlockArmed = true;
  const opts = { capture: true, passive: true };
  const unlock = () => {
    forceHeroPlay();
    setTimeout(forceHeroPlay, 150);
    setTimeout(forceHeroPlay, 600);
  };
  const onGesture = () => {
    unlock();
    window.removeEventListener('touchstart', onGesture, opts);
    window.removeEventListener('pointerdown', onGesture, opts);
    window.removeEventListener('scroll', onGesture, opts);
  };
  window.addEventListener('touchstart', onGesture, opts);
  window.addEventListener('pointerdown', onGesture, opts);
  window.addEventListener('scroll', onGesture, opts);
}

async function startHeroBackground() {
  if (!heroFilm || !heroVideoWrap) return;
  heroBgActive = true;
  await loadYouTubeApi();
  if (!heroBgActive) return;

  // YT.Player replaces #heroVideo; recreate the mount node after destroy.
  let mount = document.getElementById('heroVideo');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'heroVideo';
    heroVideoWrap.appendChild(mount);
  }

  if (heroPlayer) {
    try {
      heroPlayer.destroy();
    } catch (_) { /* ignore */ }
    heroPlayer = null;
    mount = document.createElement('div');
    mount.id = 'heroVideo';
    heroVideoWrap.innerHTML = '';
    heroVideoWrap.appendChild(mount);
  }

  heroPlayer = new YT.Player('heroVideo', {
    host: 'https://www.youtube-nocookie.com',
    videoId: heroFilm.id,
    playerVars: {
      autoplay: 1,
      mute: 1,
      controls: 0,
      playsinline: 1,
      loop: 1,
      playlist: heroFilm.id,
      rel: 0,
      modestbranding: 1,
      iv_load_policy: 3,
      disablekb: 1,
      fs: 0,
      cc_load_policy: 0,
      origin: window.location.origin,
    },
    events: {
      onReady(e) {
        e.target.mute();
        forceHeroPlay();
        // Retries help when the first autoplay is ignored on mobile.
        setTimeout(forceHeroPlay, 250);
        setTimeout(forceHeroPlay, 1000);
        setTimeout(forceHeroPlay, 2500);
        keepCaptionsOff(e.target);
        armHeroPlaybackUnlock();
      },
      onStateChange(e) {
        if (e.data === YT.PlayerState.PLAYING) {
          keepCaptionsOff(e.target);
        }
        // If mobile leaves it cued/paused, keep nudging play while hero is active.
        if (
          heroBgActive &&
          (e.data === YT.PlayerState.CUED || e.data === YT.PlayerState.PAUSED)
        ) {
          setTimeout(forceHeroPlay, 200);
        }
      },
      onApiChange(e) {
        disableCaptions(e.target);
      },
    },
  });
  armHeroPlaybackUnlock();
}

function stopHeroBackground() {
  heroBgActive = false;
  if (heroPlayer) {
    try {
      heroPlayer.stopVideo();
      heroPlayer.destroy();
    } catch (_) { /* ignore */ }
    heroPlayer = null;
  }
  if (heroVideoWrap) heroVideoWrap.innerHTML = '<div id="heroVideo"></div>';
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

async function openVideo(v) {
  closeLightbox();
  stopHeroBackground();
  videoCaption.textContent = v.title;
  videoModal.hidden = false;
  document.body.style.overflow = 'hidden';

  await loadYouTubeApi();
  if (videoModal.hidden) return;

  if (modalPlayer) {
    try {
      modalPlayer.destroy();
    } catch (_) { /* ignore */ }
    modalPlayer = null;
  }
  if (videoFrameMount) {
    videoFrameMount.innerHTML = '<div id="videoFrame"></div>';
  }

  modalPlayer = new YT.Player('videoFrame', {
    videoId: v.id,
    playerVars: {
      autoplay: 1,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      cc_load_policy: 0,
      iv_load_policy: 3,
      origin: window.location.origin,
    },
    events: {
      onReady(e) {
        e.target.playVideo();
        keepCaptionsOff(e.target, 6000);
      },
      onStateChange(e) {
        if (e.data === YT.PlayerState.PLAYING) {
          keepCaptionsOff(e.target, 6000);
        }
      },
      onApiChange(e) {
        disableCaptions(e.target);
      },
    },
  });
}

function closeVideo() {
  videoModal.hidden = true;
  if (captionKillTimer) {
    clearInterval(captionKillTimer);
    captionKillTimer = null;
  }
  if (modalPlayer) {
    try {
      modalPlayer.stopVideo();
      modalPlayer.destroy();
    } catch (_) { /* ignore */ }
    modalPlayer = null;
  }
  if (videoFrameMount) {
    videoFrameMount.innerHTML = '<div id="videoFrame"></div>';
  }
  document.body.style.overflow = '';
  if (heroFilm) startHeroBackground();
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

    tile.addEventListener('click', () => openLightbox(i, photos));
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
  observeTilesIn(grid);
}

function observeTilesIn(root) {
  if (!root) return;
  const tiles = root.querySelectorAll('.tile');
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

function openLightbox(i, list) {
  if (mode === 'edit') return;
  closeVideo();
  lbList = list && list.length ? list : photos;
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  showLightbox(i);
}

function showLightbox(i) {
  if (!lbList.length) return;
  lbIndex = (i + lbList.length) % lbList.length;
  const photo = lbList[lbIndex];
  lbImg.src = photo.src;
  lbCaption.textContent = `${lbIndex + 1} / ${lbList.length}`;
  preload(lbIndex + 1);
  preload(lbIndex - 1);
}

function preload(i) {
  if (!lbList.length) return;
  const photo = lbList[(i + lbList.length) % lbList.length];
  const im = new Image();
  im.src = photo.src;
}

function closeLightbox() {
  lightbox.hidden = true;
  lbImg.src = '';
  lbIndex = -1;
  lbList = [];
  if (videoModal.hidden) document.body.style.overflow = '';
}
