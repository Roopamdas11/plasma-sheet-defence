// /brands/fmcg.brand.js — Cleaning product universe
// Aqua / white bubble layers, dirt-grime enemies, droplet projectiles, Deep Clean Wave.
BrandEngine.registerBrand({
  id: 'fmcg',
  displayName: 'CLEAN POWER',

  palette: {
    accent:       '#00d4e8',   // bright aqua
    accentRgb:    '0,212,232',
    accentGlow:   'rgba(0,212,232,.8)',
    accent2:      '#ffffff',
    gridColor:    '#b0e8f0',
    shipGlow:     '#00d4e8',
    shipCore:     '#e0faff',
    pulseColor:   'rgba(0,212,232,',
    projColors:   ['#00d4e8','#80eeff','#ffffff','#ccf6ff'],
    towerColors:  ['#004455','#006070','#008090','#00a0b0'],
    particleColor: '#00d4e8',
  },

  typography: { hudFont: 'Orbitron,sans-serif' },

  background: {
    // Bright aqua fade from light to slightly deeper
    layers: [
      ['#e8faff','#c0f0fa','#90e0f5'],
      ['#d0f5ff','#a8e8f5','#70d5ee'],
      ['#b8eeff','#88ddf0','#50c8e8'],
      ['#98e5ff','#68d0e8','#38b8df'],
    ],
    gridStyle: 'lines',
    mood: 'bright',
  },

  enemies: {
    skins: {
      runner:    '🦠',   // bacteria
      splitter:  '💧',   // grime droplet splits
      tank:      '🟤',   // stubborn stain
      skitter:   '•',    // micro-dirt
      dodger:    '🫧',   // slippery bubble
      bruteNgon: '🧱',   // heavy grime block
      anchored:  '⬛',   // deep stain
      shielded:  '🛡',
      exploder:  '💥',
      healer:    '🌊',   // dirty water healer
    },
    colorOverrides: {
      runner:    '#8b4513',   // muddy brown
      splitter:  '#6b3a10',
      tank:      '#4a2a08',
      skitter:   '#7a4020',
      dodger:    '#c0d8ff',   // soap-bubble near-white
      bruteNgon: '#3a2010',
      anchored:  '#2a1808',
    },
  },

  projectile: { style: 'droplet', trailStyle: 'plasma' },

  pulse: {
    label: 'DEEP CLEAN WAVE',
    style: 'ripple',
  },

  audio: {
    bpmBase: 128,   // upbeat, energetic clean
    pulseExtraFreqs: [
      { freq: 880, dur: 0.12, type: 'sine',   vol: 0.09 },
      { freq: 660, dur: 0.18, type: 'square', vol: 0.06 },
    ],
  },

  behavior: { spiralEmphasis: 0.7, dodgeStyle: 'cautious' },
});
