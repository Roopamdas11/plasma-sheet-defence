// /brands/mondelez.brand.js — Chocolate / confectionery universe
// Melted chocolate background, cookie/wafer enemies, Sugar Rush Shockwave.
BrandEngine.registerBrand({
  id: 'mondelez',
  displayName: 'CHOCO RUSH',

  palette: {
    accent:       '#f0a000',   // caramel gold
    accentRgb:    '240,160,0',
    accentGlow:   'rgba(240,160,0,.8)',
    accent2:      '#ff6030',   // orange-red candy
    gridColor:    '#3d1c05',
    shipGlow:     '#f0a000',
    shipCore:     '#ffcc66',
    pulseColor:   'rgba(240,160,0,',
    projColors:   ['#f0a000','#ff8000','#ff6030','#ffffff'],
    towerColors:  ['#1a0800','#2a1000','#3a1800','#4a2200'],
    particleColor: '#f0a000',
  },

  typography: { hudFont: 'Orbitron,sans-serif' },

  background: {
    // Chocolate brown — increasingly deep and rich
    layers: [
      ['#1a0c00','#120800','#0a0400'],
      ['#221000','#180c00','#0e0600'],
      ['#2a1400','#201000','#160800'],
      ['#341a00','#281400','#1c0e00'],
    ],
    gridStyle: 'lines',
    mood: 'dark',
  },

  enemies: {
    skins: {
      runner:    '🍪',   // cookie
      splitter:  '🍫',   // chocolate chunk splits
      tank:      '🍰',   // cake slice
      skitter:   '🧇',   // wafer crumb
      dodger:    '🍬',   // candy wrapper
      bruteNgon: '🍫',   // giant bar
      anchored:  '🍮',   // caramel flan sentinel
      shielded:  '🧁',   // frosted cupcake
      exploder:  '💥',
      healer:    '🍯',   // honey healer
    },
    colorOverrides: {
      runner:    '#8b4513',
      splitter:  '#6b3010',
      tank:      '#4a2008',
      skitter:   '#c0860a',
      dodger:    '#e05090',   // candy pink
      bruteNgon: '#3a1a00',
      anchored:  '#2a1000',
    },
  },

  projectile: { style: 'dart', trailStyle: 'plasma' },

  pulse: {
    label: 'SUGAR RUSH SHOCKWAVE',
    style: 'burst',   // big pop of colour — rendered with extra rings in-game
  },

  audio: {
    bpmBase: 132,   // upbeat candy energy
    pulseExtraFreqs: [
      { freq: 440, dur: 0.14, type: 'sawtooth', vol: 0.11 },
      { freq: 550, dur: 0.10, type: 'square',   vol: 0.08 },
      { freq: 660, dur: 0.07, type: 'square',   vol: 0.06 },
    ],
  },

  behavior: { spiralEmphasis: 1.1, dodgeStyle: 'default' },
});
