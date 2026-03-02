'use strict';
// ═══════════════════════════════════════════════════════════════════════
// BRAND SCHEMA — validation + defaults
// Every brand module is validated against this schema.
// Missing fields are filled with sensible defaults.
// ═══════════════════════════════════════════════════════════════════════
window.BrandSchema = (function () {

  const DEFAULTS = {
    id: 'default',
    displayName: 'DEFAULT',

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

    typography: {
      hudFont: 'Orbitron,sans-serif',
    },

    background: {
      // 4 layers corresponding to bgPhase 0-3
      layers: [
        ['#0d0625','#08031a','#020010'],
        ['#022535','#011428','#000d20'],
        ['#1a0530','#0e021e','#060012'],
        ['#2a0810','#1a0508','#0e0203'],
      ],
      gridStyle: 'lines',   // 'lines' | 'none'
      mood: 'dark',         // 'dark' | 'bright'
    },

    enemies: {
      skins: {},            // { enemyType: '🍟' | emoji/char }
      colorOverrides: {},   // { enemyType: '#rrggbb' }
    },

    projectile: {
      style: 'dart',        // 'dart' | 'fry' | 'droplet' | 'gear'
      trailStyle: 'plasma', // 'plasma' | 'none'
    },

    pulse: {
      label: 'SHOCKWAVE',
      style: 'ring',        // 'ring' | 'ripple'
    },

    audio: {
      bpmBase: 116,
      // Extra tones fired on pulse trigger: [{freq,dur,type,vol}]
      pulseExtraFreqs: [],
    },

    behavior: {
      spiralEmphasis: 1.0,  // 0.5–1.5 multiplier on spiral motion
      dodgeStyle: 'default',// 'default' | 'aggressive'
    },
  };

  function _deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function _shallowFill(target, defaults) {
    Object.keys(defaults).forEach(k => {
      if (target[k] === undefined || target[k] === null) target[k] = defaults[k];
    });
  }

  /** Validate and return a fully-filled brand object, or null if invalid. */
  function validate(raw) {
    try {
      if (!raw || typeof raw !== 'object') throw new Error('Brand must be an object');
      const b = _deepClone(raw);

      // Required
      if (!b.id || typeof b.id !== 'string') throw new Error('Brand must have a string id');
      if (!b.displayName) b.displayName = b.id.toUpperCase();

      // Palette
      if (!b.palette || typeof b.palette !== 'object') b.palette = {};
      const dp = DEFAULTS.palette;
      _shallowFill(b.palette, dp);
      if (!Array.isArray(b.palette.projColors) || b.palette.projColors.length < 4) {
        b.palette.projColors = dp.projColors.slice();
      }
      if (!Array.isArray(b.palette.towerColors) || b.palette.towerColors.length < 4) {
        b.palette.towerColors = dp.towerColors.slice();
      }

      // Typography
      if (!b.typography || typeof b.typography !== 'object') b.typography = {};
      _shallowFill(b.typography, DEFAULTS.typography);

      // Background
      if (!b.background || typeof b.background !== 'object') b.background = {};
      if (!Array.isArray(b.background.layers) || b.background.layers.length < 1) {
        b.background.layers = _deepClone(DEFAULTS.background.layers);
      }
      // Ensure 4 layers
      while (b.background.layers.length < 4) {
        b.background.layers.push(b.background.layers[b.background.layers.length - 1]);
      }
      _shallowFill(b.background, DEFAULTS.background);

      // Enemies
      if (!b.enemies || typeof b.enemies !== 'object') b.enemies = {};
      if (!b.enemies.skins || typeof b.enemies.skins !== 'object') b.enemies.skins = {};
      if (!b.enemies.colorOverrides) b.enemies.colorOverrides = {};

      // Projectile
      if (!b.projectile || typeof b.projectile !== 'object') b.projectile = {};
      _shallowFill(b.projectile, DEFAULTS.projectile);

      // Pulse
      if (!b.pulse || typeof b.pulse !== 'object') b.pulse = {};
      _shallowFill(b.pulse, DEFAULTS.pulse);

      // Audio
      if (!b.audio || typeof b.audio !== 'object') b.audio = {};
      _shallowFill(b.audio, DEFAULTS.audio);
      if (!Array.isArray(b.audio.pulseExtraFreqs)) b.audio.pulseExtraFreqs = [];

      // Behavior
      if (!b.behavior || typeof b.behavior !== 'object') b.behavior = {};
      _shallowFill(b.behavior, DEFAULTS.behavior);
      // Clamp spiralEmphasis
      b.behavior.spiralEmphasis = Math.max(0.5, Math.min(1.5, Number(b.behavior.spiralEmphasis) || 1.0));

      return b;
    } catch (e) {
      console.warn('[BrandSchema] Invalid brand definition:', raw && raw.id, '—', e.message);
      return null;
    }
  }

  return { validate, DEFAULTS };
})();
