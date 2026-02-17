document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('gallery-lightbox');
  const grid = document.querySelector('.gallery-full .gallery-grid');
  if (!overlay || !grid) return;

  const isMobileViewport = () => window.matchMedia?.('(max-width: 820px)')?.matches;
  let lockedScrollTop = 0;
  let isScrollLocked = false;
  let lockedScrollEl = null;
  let lockedPrevOverflow = '';

  const lockScroll = () => {
    if (!isMobileViewport() || isScrollLocked) return;
    const stageCard = document.querySelector('.stage__card');
    const scrollEl = stageCard || document.scrollingElement || document.documentElement;
    lockedScrollEl = scrollEl;
    lockedScrollTop = scrollEl.scrollTop;
    lockedPrevOverflow = scrollEl.style.overflow;
    scrollEl.style.overflow = 'hidden';
    isScrollLocked = true;
  };

  const unlockScroll = () => {
    if (!isScrollLocked) return;
    const scrollEl = lockedScrollEl;
    if (scrollEl) {
      scrollEl.style.overflow = lockedPrevOverflow;
      scrollEl.scrollTop = lockedScrollTop;
    }
    isScrollLocked = false;
    lockedScrollEl = null;
  };

  const imgEl = overlay.querySelector('.lightbox__img');
  const closeBtn = overlay.querySelector('.lightbox__close');

  const openLightbox = (src, alt) => {
    imgEl.src = src;
    imgEl.alt = alt || '';

    // On mobile, ensure the overlay is fixed to the true viewport (not inside a transformed card).
    if (isMobileViewport() && overlay.parentElement !== document.body) {
      document.body.appendChild(overlay);
    }

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    lockScroll();

    // Avoid mobile scroll-jumps from focus management.
    if (!isMobileViewport()) {
      closeBtn?.focus?.();
    } else {
      try {
        closeBtn?.focus?.({ preventScroll: true });
      } catch {
        /* no-op */
      }
    }
  };

  const closeLightbox = () => {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    imgEl.src = '';
    imgEl.alt = '';
    unlockScroll();
  };

  // Delegate clicks from the grid (works for clicking img or the anchor)
  grid.addEventListener('click', (e) => {
    const link = e.target.closest('a.gallery-item');
    if (!link) return;

    e.preventDefault();
    e.stopPropagation();

    const img = link.querySelector('img');
    const hrefSrc = link.getAttribute('href') || '';
    const src = isMobileViewport()
      ? (hrefSrc ? hrefSrc.replace('-1440.jpg', '-1024.jpg') : img?.src)
      : (hrefSrc || img?.src);
    const alt = img?.alt || '';
    if (!src) return;

    openLightbox(src, alt);
  });

  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeLightbox();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeLightbox();
  });
});

(() => {
  const isMobileViewport = () => window.matchMedia?.('(max-width: 820px)')?.matches;
  let lockedScrollTop = 0;
  let isScrollLocked = false;
  let lockedScrollEl = null;
  let lockedPrevOverflow = '';

  const lockScroll = () => {
    if (!isMobileViewport() || isScrollLocked) return;
    const stageCard = document.querySelector('.stage__card');
    const scrollEl = stageCard || document.scrollingElement || document.documentElement;
    lockedScrollEl = scrollEl;
    lockedScrollTop = scrollEl.scrollTop;
    lockedPrevOverflow = scrollEl.style.overflow;
    scrollEl.style.overflow = 'hidden';
    isScrollLocked = true;
  };

  const unlockScroll = () => {
    if (!isScrollLocked) return;
    const scrollEl = lockedScrollEl;
    if (scrollEl) {
      scrollEl.style.overflow = lockedPrevOverflow;
      scrollEl.scrollTop = lockedScrollTop;
    }
    isScrollLocked = false;
    lockedScrollEl = null;
  };

  const ensureOverlay = () => {
    let overlay = document.getElementById('gallery-lightbox');
    if (overlay) return overlay;

    // Optional: create overlay if it doesn't exist in the HTML
    overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.id = 'gallery-lightbox';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="lightbox" role="dialog" aria-modal="true">
        <button class="lightbox__close" type="button" aria-label="Close image">&times;</button>
        <img class="lightbox__img" src="" alt="" />
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  };

  const openLightbox = (src, alt) => {
    const overlay = ensureOverlay();
    const imgEl = overlay.querySelector('.lightbox__img');
    const closeBtn = overlay.querySelector('.lightbox__close');

    imgEl.src = src;
    imgEl.alt = alt || '';

    // On mobile, ensure the overlay is fixed to the true viewport (not inside a transformed card).
    if (isMobileViewport() && overlay.parentElement !== document.body) {
      document.body.appendChild(overlay);
    }

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    lockScroll();

    // Avoid mobile scroll-jumps from focus management.
    if (!isMobileViewport()) {
      closeBtn?.focus?.();
    } else {
      try {
        closeBtn?.focus?.({ preventScroll: true });
      } catch {
        /* no-op */
      }
    }
  };

  const closeLightbox = () => {
    const overlay = document.getElementById('gallery-lightbox');
    if (!overlay) return;
    const imgEl = overlay.querySelector('.lightbox__img');

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    imgEl.src = '';
    imgEl.alt = '';
    unlockScroll();
  };

  // Capture phase so we beat router/navigation handlers
  document.addEventListener(
    'click',
    (e) => {
      const link = e.target.closest?.('a.gallery-item');
      if (!link) return;

      // Only activate inside the gallery section
      if (!link.closest('.gallery-full')) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();

      const img = link.querySelector('img');
      const hrefSrc = link.getAttribute('href') || '';
      const src = isMobileViewport()
        ? (hrefSrc ? hrefSrc.replace('-1440.jpg', '-1024.jpg') : img?.src)
        : (hrefSrc || img?.src);
      const alt = img?.alt || '';
      if (!src) return;

      openLightbox(src, alt);
    },
    true
  );

  document.addEventListener('click', (e) => {
    const overlay = document.getElementById('gallery-lightbox');
    if (!overlay || !overlay.classList.contains('is-open')) return;

    if (e.target === overlay) closeLightbox();
    if (e.target.closest?.('.lightbox__close')) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('gallery-lightbox');
    if (e.key === 'Escape' && overlay?.classList.contains('is-open')) closeLightbox();
  });
})();
