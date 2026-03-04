// /brands/perf.brand.js — HIGH PERFORMANCE mode
// No emoji skins, no shadow blurs, minimal glow passes.
// All canvas ctx.shadowBlur calls are gated behind T().perfMode in drawEnemy.
// Use this on low-end devices or when you want max framerate.
BrandEngine.registerBrand({
  id: 'perf',
  displayName: 'PERF',

  // ── The magic flag ───────────────────────────────────────────────────
  // game.js reads T().perfMode and skips: shadow blurs on enemies,
  // emoji glyph sprites, spiralHunter aura ring, anchored dash ring,
  // and the red-flash glow bloom. Core gameplay is 100% unchanged.
  perfMode: true,

  palette: {
    accent:       '#00ff88',   // clean green — high contrast, no flicker
    accentRgb:    '0,255,136',
    accentGlow:   'rgba(0,255,136,.7)',
    accent2:      '#00cc66',
    gridColor:    '#003322',
    shipGlow:     '#00ff88',
    shipCore:     '#00ffcc',
    pulseColor:   'rgba(0,255,136,',
    projColors:   ['#00ff88','#00ccff','#ffff00','#ff8800'],
    towerColors:  ['#001a0e','#002214','#002e1a','#003a20'],
    particleColor: '#00ff88',
  },

  typography: { hudFont: '"Share Tech Mono",monospace' },

  background: {
    // Single flat dark layer — no per-phase color shift cost
    layers: [
      ['#020f07','#010a04','#000602'],
      ['#030f07','#020a04','#010602'],
      ['#030f07','#020a04','#010602'],
      ['#030f07','#020a04','#010602'],
    ],
    gridStyle: 'lines',
    mood: 'dark',
  },

  enemies: {
    skins: {},         // empty — no emoji rendering in perf mode
    colorOverrides: {},
  },

  projectile: { style: 'dart', trailStyle: 'none' },

  pulse: { label: 'PULSE', style: 'ring' },

  audio: { bpmBase: 120 },

  behavior: { spiralEmphasis: 1.0, dodgeStyle: 'default' },
});
