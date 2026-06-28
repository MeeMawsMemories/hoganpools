(() => {
  const isMobileViewport = () => window.matchMedia?.('(max-width: 820px)')?.matches;
  const parser = new DOMParser();
  let activeSetup = null;
  let globalHandlersBound = false;

  const isStageTransitioning = () => document.body.classList.contains('is-stage-transitioning');
  const isStageActivelySliding = () => {
    const stage = document.querySelector('.stage');
    if (!stage) return false;
    return [
      'is-sliding',
      'stage-prep',
      'slide-out-left',
      'slide-out-right',
      'slide-in-from-left',
      'slide-in-from-right',
    ].some((className) => stage.classList.contains(className));
  };
  const buildProjectUrl = (projectId) => `/gallery/?project=${encodeURIComponent(projectId)}`;

  const bindGlobalHandlers = () => {
    if (globalHandlersBound) return;

    document.addEventListener('click', (event) => {
      const link = event.target?.closest?.('a.gallery-item');
      if (!link || !link.closest('.gallery-full')) return;

      if (isStageTransitioning() && isStageActivelySliding()) {
        return;
      }

      const projectId = link.dataset.galleryProject;
      if (!projectId || !activeSetup) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      activeSetup.openProject(projectId);
    }, { capture: true });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && activeSetup?.isOpen()) {
        activeSetup.closeProject();
      }
    });

    window.addEventListener('popstate', () => {
      if (!activeSetup) return;

      const params = new URLSearchParams(window.location.search);
      const projectId = params.get('project');

      if (projectId && activeSetup.hasProject(projectId)) {
        activeSetup.openProject(projectId, { updateHistory: false });
        return;
      }

      if (activeSetup.isOpen()) {
        activeSetup.closeProject({ updateHistory: false });
      }
    });

    globalHandlersBound = true;
  };

  const setup = ({ overlay, modal, content, closeBtn, grid }) => {
    bindGlobalHandlers();

    const projectCache = new Map();
    let activeCardCleanup = null;
    let lockedScrollEl = null;
    let lockedScrollTop = 0;
    let lockedPrevOverflow = '';

    const lockScroll = () => {
      if (!isMobileViewport() || lockedScrollEl) return;
      const stageCard = document.querySelector('.stage__card');
      const scrollEl = stageCard || document.scrollingElement || document.documentElement;
      lockedScrollEl = scrollEl;
      lockedScrollTop = scrollEl.scrollTop;
      lockedPrevOverflow = scrollEl.style.overflow;
      scrollEl.style.overflow = 'hidden';
    };

    const unlockScroll = () => {
      if (!lockedScrollEl) return;
      lockedScrollEl.style.overflow = lockedPrevOverflow;
      lockedScrollEl.scrollTop = lockedScrollTop;
      lockedScrollEl = null;
    };

    const getProjectLink = (projectId) => (
      grid.querySelector(`[data-gallery-project="${CSS.escape(projectId)}"]`)
    );

    const getProjectPath = (projectId) => {
      const link = getProjectLink(projectId);
      return link?.getAttribute('href') || `/gallery/${projectId.toLowerCase()}/`;
    };

    const loadProjectCard = async (projectId) => {
      if (projectCache.has(projectId)) {
        return projectCache.get(projectId).cloneNode(true);
      }
      try {
        const response = await fetch(getProjectPath(projectId), { cache: 'no-store' });
        if (!response.ok) return null;

        const html = await response.text();
        const doc = parser.parseFromString(html, 'text/html');
        const card = doc.querySelector(`#${CSS.escape(projectId)}.gallery-project-card`);
        if (!card) return null;

        projectCache.set(projectId, card);
        return card.cloneNode(true);
      } catch (err) {
        // Don't let fetch/parse errors break the UI; surface a console warning and
        // return null so the caller can fallback to navigation.
        // eslint-disable-next-line no-console
        console.warn('Failed to load gallery project', projectId, err);
        return null;
      }
    };

    const openProject = async (projectId, options = {}) => {
      const card = await loadProjectCard(projectId);
      if (!card) {
        // If we couldn't load the project card (network error or missing markup),
        // fall back to navigating to the project page so the user still sees content.
        const path = getProjectPath(projectId);
        try {
          window.location.href = path;
        } catch {
          // ignore navigation errors
        }
        return;
      }

      activeCardCleanup?.();
      content.replaceChildren(card);
      activeCardCleanup = window.HoganPoolsGalleryProjectCard?.init?.(card) || null;
      modal.setAttribute('aria-label', card.dataset.projectTitle || projectId);

      if (overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
      }

      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-open');
      lockScroll();

      if (options.updateHistory !== false && window.history?.pushState) {
        window.history.pushState({ galleryProject: projectId }, '', buildProjectUrl(projectId));
      }

      try {
        closeBtn?.focus?.({ preventScroll: isMobileViewport() });
      } catch {
        closeBtn?.focus?.();
      }
    };

    const closeProject = (options = {}) => {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('lightbox-open');
      activeCardCleanup?.();
      activeCardCleanup = null;
      content.replaceChildren();
      unlockScroll();

      if (options.updateHistory !== false && window.history?.pushState) {
        window.history.pushState({}, '', '/gallery/');
      }
    };
    activeSetup = {
      openProject,
      closeProject,
      hasProject: (projectId) => Boolean(getProjectLink(projectId)),
      isOpen: () => overlay.classList.contains('is-open'),
    };

    if (overlay.dataset.lightboxBound !== 'true') {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay || event.target.closest('.gallery-project-modal__close')) {
          event.preventDefault();
          closeProject();
        }
      });

      overlay.addEventListener('click', (event) => {
        const placeholderLink = event.target.closest('[data-video-placeholder]');
        if (!placeholderLink) return;
        event.preventDefault();
      });

      overlay.dataset.lightboxBound = 'true';
    }

    const initialProject = new URLSearchParams(window.location.search).get('project');
    if (initialProject && getProjectLink(initialProject)) {
      openProject(initialProject, { updateHistory: false });
    }
  };

  const tryInit = () => {
    const overlay = document.getElementById('gallery-project-overlay');
    const modal = overlay?.querySelector('.gallery-project-modal');
    const content = document.getElementById('gallery-project-content');
    const closeBtn = overlay?.querySelector('.gallery-project-modal__close');
    const grid = document.querySelector('.gallery-full .gallery-grid');

    if (overlay && modal && content && grid) {
      setup({ overlay, modal, content, closeBtn, grid });
      return true;
    }
    return false;
  };

  if (!tryInit()) {
    const mo = new MutationObserver((mutations, observer) => {
      if (tryInit()) observer.disconnect();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
