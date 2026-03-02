// /brands/default.brand.js — Classic plasma aesthetic
BrandEngine.registerBrand({
  id: 'default',
  displayName: 'DEFAULT',
  hidden: true,   // silent fallback — never shown in the theme selector

  palette: {
    accent:       '#00e5ff',
    accentRgb:    '0,229,255',
    accentGlow:   'rgba(0,229,255,.8)',
    accent2:      '#00ff99',
    gridColor:    '#3333aa',
    shipGlow:     '#00e5ff',
    shipCore:     '#00ffff',
    pulseColor:   'rgba(0,229,255,',
    projColors:   ['#00e5ff','#ff00cc','#cc88ff','#ffd700'],
    towerColors:  ['#1a0840','#220a55','#2a0e6e','#33118a'],
    particleColor: null,
  },

  typography: { hudFont: 'Orbitron,sans-serif' },

  background: {
    layers: [
      ['#0d0625','#08031a','#020010'],
      ['#022535','#011428','#000d20'],
      ['#1a0530','#0e021e','#060012'],
      ['#2a0810','#1a0508','#0e0203'],
    ],
    gridStyle: 'lines',
    mood: 'dark',
  },

  enemies: { skins: {}, colorOverrides: {} },

  projectile: { style: 'dart', trailStyle: 'plasma' },

  pulse: { label: 'SHOCKWAVE', style: 'ring' },

  audio: {
    bpmBase: 116,
    pulseExtraFreqs: [],
  },

  behavior: { spiralEmphasis: 1.0, dodgeStyle: 'default' },
});
