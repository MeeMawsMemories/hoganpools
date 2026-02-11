(() => {
  const ensureOverlay = () => {
    let overlay = document.getElementById('gallery-lightbox');
    if (overlay) return overlay;

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

  const initLightbox = () => {
    if (document.documentElement.dataset.galleryLightbox === 'true') return;
    document.documentElement.dataset.galleryLightbox = 'true';

    const overlay = ensureOverlay();
    const imgEl = overlay.querySelector('.lightbox__img');
    const closeBtn = overlay.querySelector('.lightbox__close');

    const openLightbox = (src, alt) => {
      imgEl.src = src;
      imgEl.alt = alt || '';
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-open');
      closeBtn?.focus?.();
    };

    const closeLightbox = () => {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('lightbox-open');
      imgEl.src = '';
      imgEl.alt = '';
    };

    document.addEventListener(
      'click',
      (e) => {
        const link = e.target.closest?.('a.gallery-item');
        if (!link || !link.closest('.gallery-full')) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();

        const img = link.querySelector('img');
        const src = link.getAttribute('href') || img?.src;
        const alt = img?.alt || '';
        if (!src) return;

        openLightbox(src, alt);
      },
      true
    );

    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      closeLightbox();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeLightbox();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLightbox, { once: true });
  } else {
    initLightbox();
  }
})();
