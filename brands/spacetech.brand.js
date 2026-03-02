// /brands/spacetech.brand.js — Deep space tactical aesthetic
BrandEngine.registerBrand({
  id: 'spacetech',
  displayName: 'SPACE TECH',

  palette: {
    accent:       '#88ccff',
    accentRgb:    '136,204,255',
    accentGlow:   'rgba(136,204,255,.85)',
    accent2:      '#ffffff',
    gridColor:    '#002244',
    shipGlow:     '#88ccff',
    shipCore:     '#cceeff',
    pulseColor:   'rgba(136,204,255,',
    projColors:   ['#88ccff','#ffffff','#aaddff','#ffffc8'],
    towerColors:  ['#001030','#001848','#002060','#002878'],
    particleColor: '#88ccff',
  },

  typography: { hudFont: 'Share Tech Mono,monospace' },

  background: {
    layers: [
      ['#000e22','#000814','#000408'],
      ['#001030','#000c20','#000510'],
      ['#001540','#000c28','#000618'],
      ['#001a50','#001030','#00081e'],
    ],
    gridStyle: 'lines',
    mood: 'dark',
  },

  enemies: {
    skins: {
      runner:    '▲',
      splitter:  '●',
      tank:      '⬡',
      skitter:   '▸',
      dodger:    '◁',
      bruteNgon: '⬟',
      anchored:  '⊕',
      shielded:  '◯',
      exploder:  '💥',
      healer:    '⊛',
    },
    colorOverrides: {},
  },

  projectile: { style: 'dart', trailStyle: 'plasma' },

  pulse: { label: 'PULSE BLAST', style: 'ring' },

  audio: {
    bpmBase: 122,
    pulseExtraFreqs: [
      { freq: 320, dur: 0.15, type: 'sine',  vol: 0.08 },
    ],
  },

  behavior: { spiralEmphasis: 1.2, dodgeStyle: 'aggressive' },
});
