// /brands/spaceopera.brand.js
// SPACE OPERA — a galaxy-far-away vibe.
// Neon saber glows, imperial-triangle fighters, droid skitters, starfield
// backgrounds. Purely original shapes and generic space-opera references.
// No logos, characters, or trademarked film assets.
BrandEngine.registerBrand({
  id: 'spaceopera',
  displayName: 'SPACE OPERA',

  palette: {
    accent:       '#b0003a',   // crimson saber hue
    accentRgb:    '176,0,58',
    accentGlow:   'rgba(176,0,58,.85)',
    accent2:      '#3ae4ff',   // rebel-blue counter-saber
    gridColor:    '#1a0020',
    shipGlow:     '#3ae4ff',   // player saber = rebel blue
    shipCore:     '#ffffff',
    pulseColor:   'rgba(176,0,58,',
    projColors:   ['#3ae4ff','#00ffcc','#ffffff','#ff2266'],  // blue saber bolts
    towerColors:  ['#0d001a','#160026','#1e0033','#280040'],
    particleColor: '#b0003a',
  },

  typography: {
    hudFont: '"Share Tech Mono",monospace',
  },

  background: {
    // Deep space — shifts from near-black to blood-red as intensity rises
    layers: [
      ['#02000a','#060010','#0a001a'],   // phase 0: starfield void
      ['#0a0020','#160030','#05000f'],   // phase 1: nebula hints
      ['#1a0028','#260018','#08000e'],   // phase 2: battle-smoke red-purple
      ['#2a0010','#3a0010','#100005'],   // phase 3: full battle-mode crimson
    ],
    gridStyle: 'lines',
    mood: 'dark',
  },

  enemies: {
    skins: {
      runner:      '▲',    // TIE-fighter triangle silhouette
      splitter:    '◈',    // splitting energy orb
      leech:       '◎',    // targeting reticle
      tank:        '⬡',    // heavy-armour hexagon destroyer
      skitter:     '·',    // tiny probe droid
      dodger:      '◇',    // phantom interceptor
      bruteNgon:   '⬟',    // super star destroyer wedge
      anchored:    '⊛',    // orbital defence station
      shielded:    '◉',    // shield-domed destroyer
      exploder:    '✦',    // thermal detonator
      healer:      '☯',    // force healer
      spiralHunter:'⟳',   // spinning saber drone
    },
    colorOverrides: {
      runner:       '#cccccc',   // grey fighter hull
      splitter:     '#b0003a',   // crimson energy
      tank:         '#445566',   // dark steel destroyer
      skitter:      '#888888',   // probe droid gunmetal
      dodger:       '#3ae4ff',   // rebel interceptor blue
      bruteNgon:    '#223344',   // star destroyer hull
      anchored:     '#334455',   // battle-station grey
      spiralHunter: '#ff3366',   // dark-side saber pink
    },
  },

  projectile: {
    style: 'dart',      // fast blaster bolt (dart = best shape)
    trailStyle: 'plasma',
  },

  pulse: {
    label: 'FORCE SURGE',
    style: 'burst',      // explosive force-ripple
  },

  audio: {
    bpmBase: 132,        // Imperial March-ish intensity
    pulseExtraFreqs: [
      { freq: 220, dur: 0.22, type: 'sawtooth', vol: 0.09 },
      { freq: 110, dur: 0.40, type: 'sawtooth', vol: 0.07 },
    ],
  },

  behavior: {
    spiralEmphasis: 1.2,    // hunters spiral aggressively
    dodgeStyle: 'aggressive',
  },
});
