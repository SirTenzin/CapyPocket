export function makeViewportGuard(): string {
  return `(() => {
    if (location.origin !== 'https://capy.ai' || window !== window.top) return;
    if (window.__capyPocketViewport) { window.__capyPocketViewport(); return; }
    const apply = () => {
      if (!document.head) return;
      let metas = Array.from(document.querySelectorAll('meta[name="viewport"]'));
      if (!metas.length) {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
        document.head.appendChild(meta);
        metas = [meta];
      }
      for (const meta of metas) {
        const parts = (meta.content || '').split(',').map((part) => part.trim()).filter((part) => part && part.split('=')[0].trim().toLowerCase() !== 'maximum-scale');
        const content = [...parts, 'maximum-scale=1'].join(', ');
        if (meta.content !== content) meta.content = content;
      }
    };
    window.__capyPocketViewport = apply;
    new MutationObserver(apply).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['name', 'content'] });
    apply();
  })(); true;`;
}

export function makePageBridge(fontScale: number, safeTop = 0): string {
  const percent = Math.round((Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1) * 100);
  const topInset = Number.isFinite(safeTop) ? Math.max(0, safeTop) : 0;
  return makeViewportGuard() + `(() => {
    if (location.origin !== 'https://capy.ai' || window !== window.top) return;
    const id = 'capy-pocket-text-size';
    let style = document.getElementById(id);
    if (!style) { style = document.createElement('style'); style.id = id; (document.head || document.documentElement).appendChild(style); }
    style.textContent = ':root { --safe-top: 0px !important; --safe-bottom: 12px !important; } :root:has([data-slot="sidebar-wrapper"]) { --safe-top: ${topInset}px !important; } html, body, body * { -webkit-text-size-adjust: ${percent}% !important; text-size-adjust: ${percent}% !important; } :root[data-capy-pocket-home] [data-slot="sidebar-wrapper"] { padding-top: 0 !important; } :root[data-capy-pocket-home] [data-slot="sidebar-panel"] main > div { padding-top: var(--safe-top); box-sizing: border-box; } :root[data-capy-pocket-home] [data-slot="sidebar-panel"] main > div > [class~="top-1.5"] { top: calc(var(--safe-top) + 0.375rem) !important; }';
    if (window.__capyPocketEdges) { window.__capyPocketEdges(); return; }
    let last = '';
    let pending = false;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const colorAt = (y) => {
      let node = document.elementFromPoint(Math.floor(innerWidth / 2), y);
      const layers = [];
      while (node) { layers.push(getComputedStyle(node).backgroundColor); node = node.parentElement; }
      const fallback = matchMedia('(prefers-color-scheme: dark)').matches ? '#0c090b' : '#ffffff';
      if (!context) return fallback;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = fallback;
      context.fillRect(0, 0, 1, 1);
      for (const color of layers.reverse()) { context.fillStyle = color; context.fillRect(0, 0, 1, 1); }
      return '#' + Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
    };
    const sample = () => {
      pending = false;
      if (!document.body) return;
      if (!document.getElementById(id)) (document.head || document.documentElement).appendChild(style);
      const edgeToEdge = !!document.querySelector('[data-slot="sidebar-wrapper"]');
      document.documentElement.toggleAttribute('data-capy-pocket-home', edgeToEdge && location.pathname.replace(/\\/$/, '') === '/new');
      const viewport = window.visualViewport;
      const top = viewport ? viewport.offsetTop : 0;
      const height = viewport ? viewport.height : innerHeight;
      const message = JSON.stringify({ type: 'capy-pocket-colors', top: colorAt(top + 2), bottom: colorAt(Math.min(innerHeight - 2, top + height - 2)), edgeToEdge });
      if (message !== last) { last = message; window.ReactNativeWebView?.postMessage(message); }
    };
    const schedule = () => { if (!pending) { pending = true; setTimeout(sample, 150); } };
    window.__capyPocketEdges = schedule;
    new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'content'] });
    addEventListener('scroll', schedule, true);
    addEventListener('resize', schedule);
    addEventListener('pageshow', schedule);
    addEventListener('popstate', schedule);
    addEventListener('transitionend', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', schedule);
    sample();
  })(); true;`;
}
