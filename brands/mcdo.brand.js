// /brands/mcdo.brand.js — Fast food universe
// Paper-bag warmth, golden arches energy, fry darts, Sauce Blast pulse.
BrandEngine.registerBrand({
  id: 'mcdo',
  displayName: 'MC SPONSOR',

  palette: {
    accent:       '#ffcc00',
    accentRgb:    '255,204,0',
    accentGlow:   'rgba(255,204,0,.8)',
    accent2:      '#ff3300',
    gridColor:    '#442200',
    shipGlow:     '#ffcc00',
    shipCore:     '#ff9900',
    pulseColor:   'rgba(255,180,0,',
    projColors:   ['#ffcc00','#ff6600','#ff3300','#ff0000'],
    towerColors:  ['#3a1200','#4a1800','#5a2000','#6a2800'],
    particleColor: '#ffcc00',
  },

  typography: { hudFont: 'Orbitron,sans-serif' },

  background: {
    // Mood shifts: bright at high combo, darker when tower low
    // — the game reads layers[bgPhase], giving increasingly saturated oranges
    layers: [
      ['#1a0800','#120500','#080200'],
      ['#200a00','#180700','#0e0400'],
      ['#2a0e00','#220a00','#160600'],
      ['#330f00','#280c00','#180800'],
    ],
    gridStyle: 'lines',
    mood: 'warm',
  },

  enemies: {
    skins: {
      runner:    '🍟',
      splitter:  '🍗',
      tank:      '🍔',
      skitter:   '🥡',
      dodger:    '🥫',
      bruteNgon: '🍔',
      anchored:  '🍖',
      shielded:  '🥤',
      exploder:  '🍅',
      healer:    '🎁',
    },
    colorOverrides: {
      runner:    '#ffaa00',
      splitter:  '#ff6600',
      tank:      '#cc3300',
      skitter:   '#ffcc00',
    },
  },

  // Projectiles look like fries (same dart shape, different colour tier)
  projectile: { style: 'fry', trailStyle: 'plasma' },

  pulse: { label: 'SAUCE BLAST', style: 'burst' },

  audio: {
    bpmBase: 120,
    // Extra upbeat "bah-da-bah" hit on pulse
    pulseExtraFreqs: [
      { freq: 550, dur: 0.10, type: 'square', vol: 0.10 },
      { freq: 660, dur: 0.08, type: 'square', vol: 0.07 },
    ],
  },

  behavior: { spiralEmphasis: 0.8, dodgeStyle: 'default' },
});
