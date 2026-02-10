(() => {
  const ORG_ID = '58414';
  const PARTNER = 'hogan-pools';
  const SCRIPT_ID = 'hearth-script';
  const SCRIPT_SRC = 'https://widget.gethearth.com/script.js';
  const IFRAME_ID = 'hearth-widget_calculator_v1';

  const ensureHearth = () => {
    const iframe = document.getElementById(IFRAME_ID);
    if (!iframe) return; // not on the financing view (yet)

    // If script already present, don’t add again
    if (document.getElementById(SCRIPT_ID)) return;

    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    s.dataset.orgid = ORG_ID;
    s.dataset.partner = PARTNER;

    document.head.appendChild(s);
  };

  // Run now
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureHearth, { once: true });
  } else {
    ensureHearth();
  }

  // Run on SPA navigations / DOM swaps
  window.addEventListener('popstate', ensureHearth);
  window.addEventListener('hashchange', ensureHearth);

  // Catch content injection into the DOM (common in your setup)
  const mo = new MutationObserver(() => ensureHearth());
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();