// /brands/magickingdom.brand.js
// MAGIC KINGDOM — whimsical fairy-tale castle world.
// Sparkles, pastel gradients, pixie-dust projectiles, enchanted creature enemies.
// Purely original generic shapes — no Disney logos, characters, or IP.
BrandEngine.registerBrand({
  id: 'magickingdom',
  displayName: 'MAGIC REALM',

  palette: {
    accent:       '#ff66cc',   // fairy-dust pink
    accentRgb:    '255,102,204',
    accentGlow:   'rgba(255,102,204,.85)',
    accent2:      '#ffdd66',   // starlight gold
    gridColor:    '#3a0040',
    shipGlow:     '#ffdd66',
    shipCore:     '#ffe0ff',
    pulseColor:   'rgba(255,102,204,',
    projColors:   ['#ff66cc','#ffdd66','#aaddff','#ffffff'],
    towerColors:  ['#220033','#2e0044','#3a0055','#480066'],
    particleColor: '#ff66cc',
  },

  typography: {
    hudFont: '"Orbitron",sans-serif',
  },

  background: {
    // Enchanted twilight — shifts from deep purple to sunset pink
    layers: [
      ['#0e001a','#160022','#04000e'],   // phase 0: midnight castle
      ['#180028','#240036','#0a001c'],   // phase 1: twilight magic
      ['#28003a','#360048','#180028'],   // phase 2: enchanted glow
      ['#3a0048','#4a0060','#220038'],   // phase 3: full spell-surge
    ],
    gridStyle: 'lines',
    mood: 'whimsical',
  },

  enemies: {
    skins: {
      runner:      '✦',    // spritely pixie spark
      splitter:    '❋',    // enchanted blossom
      leech:       '🌙',   // moon spirit
      tank:        '🏰',   // stone castle guardian
      skitter:     '✧',    // darting fairy dust mote
      dodger:      '🦋',   // phantom butterfly
      bruteNgon:   '🐲',   // dungeon dragon
      anchored:    '⛩',    // enchanted gate
      shielded:    '🌟',   // starlight barrier
      exploder:    '💫',   // wish explosion
      healer:      '🌸',   // blossom healer
      spiralHunter:'🌀',   // vortex sprite
    },
    colorOverrides: {
      runner:       '#ff88ee',
      splitter:     '#cc88ff',
      tank:         '#7755aa',
      skitter:      '#ffdd88',
      dodger:       '#88ddff',
      bruteNgon:    '#553366',
      anchored:     '#442255',
      spiralHunter: '#ff44cc',
    },
  },

  projectile: {
    style: 'droplet',   // pixie-dust teardrop
    trailStyle: 'plasma',
  },

  pulse: {
    label: 'WISH WAVE',
    style: 'ripple',    // gentle expanding sparkle rings
  },

  audio: {
    bpmBase: 108,        // waltz-like gentle tempo
    pulseExtraFreqs: [
      { freq: 880, dur: 0.14, type: 'triangle', vol: 0.08 },
      { freq: 1100, dur: 0.10, type: 'triangle', vol: 0.06 },
    ],
  },

  behavior: {
    spiralEmphasis: 0.9,
    dodgeStyle: 'default',
  },
});
