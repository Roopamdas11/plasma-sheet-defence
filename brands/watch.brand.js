// /brands/watch.brand.js — Luxury horology universe
// Brushed dark metal, gear-silhouette grid, clock-part enemies, Time Distortion pulse.
BrandEngine.registerBrand({
  id: 'watch',
  displayName: 'HOROLOGY',

  palette: {
    accent:       '#d4af37',   // antique gold
    accentRgb:    '212,175,55',
    accentGlow:   'rgba(212,175,55,.75)',
    accent2:      '#c0c0c0',   // silver
    gridColor:    '#2a2218',   // dark brass
    shipGlow:     '#d4af37',
    shipCore:     '#ffe082',
    pulseColor:   'rgba(212,175,55,',
    projColors:   ['#d4af37','#c0c0c0','#ffe082','#ffffff'],
    towerColors:  ['#0e0c08','#1a1710','#262219','#302c20'],
    particleColor: '#d4af37',
  },

  typography: { hudFont: 'Georgia,serif' },

  background: {
    layers: [
      ['#0a0906','#060504','#020201'],
      ['#120e08','#0c0a06','#060403'],
      ['#1a1410','#120e0a','#0a0806'],
      ['#221a14','#1a1410','#0e0a08'],
    ],
    gridStyle: 'lines',   // game renders this; brand gives colour cue via gridColor
    mood: 'dark',
  },

  enemies: {
    skins: {
      runner:    '↻',    // sweeping second hand
      splitter:  '⚙',    // small gear splits
      tank:      '🕰',   // mantel clock
      skitter:   '↺',    // erratic hand
      dodger:    '⧖',    // hourglass (elusive)
      bruteNgon: '⚙',    // heavy gear
      anchored:  '⌚',   // watch face sentinel
      shielded:  '◉',    // crystal-shielded
      exploder:  '💥',
      healer:    '∞',    // perpetual motion healer
    },
    colorOverrides: {
      runner:    '#a08020',
      splitter:  '#808080',
      tank:      '#704000',
      skitter:   '#c0c0c0',
      dodger:    '#d4af37',
      bruteNgon: '#404040',
      anchored:  '#282010',
    },
  },

  projectile: { style: 'gear', trailStyle: 'plasma' },

  pulse: {
    label: 'TIME DISTORTION',
    style: 'ripple',   // slow expanding rings — game reads this for visual variant
  },

  audio: {
    bpmBase: 100,    // slower, deliberate tempo
    pulseExtraFreqs: [
      { freq: 180, dur: 0.55, type: 'sine',     vol: 0.14 },
      { freq:  90, dur: 0.80, type: 'triangle', vol: 0.10 },
    ],
  },

  behavior: {
    spiralEmphasis: 1.4,   // strong spiral — enemies circle like clock hands
    dodgeStyle: 'aggressive',
  },
});
