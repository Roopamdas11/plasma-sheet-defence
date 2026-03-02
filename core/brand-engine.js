'use strict';
// ═══════════════════════════════════════════════════════════════════════
// BRAND ENGINE
// Drop ONE file into /brands/ → brand appears automatically.
// No edits to core files ever required.
// ═══════════════════════════════════════════════════════════════════════
window.BrandEngine = (function () {

  // ── Internal registry ─────────────────────────────────────────────
  const _registry = new Map();       // id → validated brand object
  const _loadOrder = [];             // preserves insertion order for UI
  let _currentId = 'default';

  // ── Public: called by brand files ─────────────────────────────────
  function registerBrand(raw) {
    const brand = window.BrandSchema.validate(raw);
    if (!brand) return;
    if (!_registry.has(brand.id)) _loadOrder.push(brand.id);
    _registry.set(brand.id, brand);
    console.log('[BrandEngine] ✓ Registered brand:', brand.id, '—', brand.displayName);
  }

  // ── Getters ────────────────────────────────────────────────────────
  function getBrands() {
    return _loadOrder.map(id => _registry.get(id)).filter(Boolean);
  }

  function getBrand(id) {
    return _registry.get(id) || _registry.get('default') || null;
  }

  function getCurrentBrand() { return getBrand(_currentId); }
  function getCurrentId()    { return _currentId; }

  // ── Legacy adapter: game.js calls T() which calls this ────────────
  // Returns a flat object that exactly matches the old THEMES[x] shape.
  function getLegacyTheme() {
    const b = getCurrentBrand();
    if (!b) return {};
    return {
      name:         b.displayName,
      accent:       b.palette.accent,
      accentRgb:    b.palette.accentRgb,
      accentGlow:   b.palette.accentGlow,
      accent2:      b.palette.accent2,
      bgColors:     b.background.layers,
      gridColor:    b.palette.gridColor,
      shipGlow:     b.palette.shipGlow,
      shipCore:     b.palette.shipCore,
      projColors:   b.palette.projColors,
      pulseColor:   b.palette.pulseColor,
      hudFont:      b.typography.hudFont,
      enemySkin:    b.enemies.skins,
      enemyColorOverrides: b.enemies.colorOverrides || {},
      particleColor: b.palette.particleColor,
      towerColors:  b.palette.towerColors,
      effectLabel:  b.pulse.label,
      pulseStyle:   b.pulse.style,
      projStyle:    b.projectile.style,
      audioProfile: b.audio,
      behavior:     b.behavior,
    };
  }

  // ── Apply a brand: CSS vars + button states + localStorage ─────────
  function applyBrand(id) {
    if (!_registry.has(id)) {
      console.warn('[BrandEngine] Unknown brand:', id, '→ falling back to default');
      id = 'default';
    }
    _currentId = id;

    // Persist choice
    try { localStorage.setItem('psd_brand', id); } catch (_) {}

    // Inject CSS custom properties
    const b = getCurrentBrand();
    const rs = document.documentElement.style;
    rs.setProperty('--accent',     b.palette.accent);
    rs.setProperty('--accent-rgb', b.palette.accentRgb);
    rs.setProperty('--accent-glow',b.palette.accentGlow);
    rs.setProperty('--hud-font',   b.typography.hudFont);

    // Update brand row buttons (if the overlay is already built)
    _refreshBrandRow(id);

    // Notify the rest of the game
    window.dispatchEvent(new CustomEvent('brandChanged', { detail: { id, brand: b } }));
  }

  // ── Build the dynamic brand-row in the pause overlay ───────────────
  function buildBrandRow() {
    const row = document.getElementById('brand-row');
    if (!row) return;
    row.innerHTML = '';

    const label = document.createElement('span');
    label.style.cssText = 'color:rgba(0,229,255,.5);font-size:.6rem;letter-spacing:2px';
    label.textContent = 'BRAND:';
    row.appendChild(label);

    getBrands().forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'menu-tog brand-tog' + (b.id === _currentId ? ' on' : '');
      btn.dataset.brandId = b.id;
      btn.textContent = b.displayName;
      btn.addEventListener('click', () => applyBrand(b.id));
      row.appendChild(btn);
    });
  }

  function _refreshBrandRow(activeId) {
    const row = document.getElementById('brand-row');
    if (!row) return;
    row.querySelectorAll('.brand-tog').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.brandId === activeId);
    });
  }

  // ── Init: restore saved brand, apply, build UI ──────────────────────
  function init() {
    // Restore saved brand (fall back to default if brand was removed)
    try {
      const saved = localStorage.getItem('psd_brand');
      if (saved && _registry.has(saved)) _currentId = saved;
    } catch (_) {}
    if (!_registry.has(_currentId)) _currentId = 'default';
    if (!_registry.has(_currentId) && _loadOrder.length) _currentId = _loadOrder[0];

    applyBrand(_currentId);
    buildBrandRow();
  }

  return {
    registerBrand,
    getBrands,
    getBrand,
    getCurrentBrand,
    getCurrentId,
    getLegacyTheme,
    applyBrand,
    buildBrandRow,
    init,
  };
})();
