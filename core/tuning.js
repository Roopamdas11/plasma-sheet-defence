'use strict';
// ═══════════════════════════════════════════════════════════════════════
// PLASMA SHEET DEFENSE — core/tuning.js
//
// HOW TO TWEAK GAMEPLAY (quick reference)
// ────────────────────────────────────────
// All main knobs live in BASE (constants) and PRESETS (per-difficulty).
//
// | Knob                   | Where    | Effect                               |
// |------------------------|----------|--------------------------------------|
// | towerHp                | PRESETS  | Tower start/max HP                   |
// | towerRegenAmount       | PRESETS  | HP restored every regen tick         |
// | enemyHpMult            | PRESETS  | Scales all enemy HP                  |
// | enemySpeedMult         | PRESETS  | Scales all enemy movement speed      |
// | spawnIntervalMult      | PRESETS  | >1 = slower waves, <1 = faster       |
// | enemyCapMult           | PRESETS  | Scales max live enemies on screen    |
// | pulseCooldownMult      | PRESETS  | >1 = slower recharge, <1 = faster    |
// | projectileDamageMult   | PRESETS  | Scales dart hit damage               |
// | ramDamageBase          | PRESETS  | Body-collision base damage per hit   |
// | scoreMult              | PRESETS  | Score multiplier                     |
// | pulseMaxCd             | BASE     | Base pulse cooldown (seconds)        |
// | pulseBaseForce         | BASE     | Knockback impulse on pulse ring      |
// | bossThresholds         | BASE     | Score values that trigger boss events|
// ═══════════════════════════════════════════════════════════════════════
window.Tuning = (function () {

  // ── Utility ──────────────────────────────────────────────────────────
  const _c = (v, mn, mx) => Math.max(mn, Math.min(mx, +v || mn));

  // ── BASE VALUES ──────────────────────────────────────────────────────
  // Constants that don't change with difficulty.
  const BASE = {
    // Tower
    towerRegenInterval:  4,      // seconds between passive regen ticks
    towerHealMax:        2.5,    // max heal per heavy-kill event
    towerHealBase:       0.8,    // base heal: towerHealBase + mass*0.25
    towerHealThreshold:  0.7,    // above this HP fraction heals are nerfed ×0.35

    // Player
    playerFireRate:      0.55,   // base fire period (seconds); lower = faster
    dartSpeedBase:       340,    // base dart speed (px/s)

    // Projectile tier damage multipliers (tiers 1-4)
    projTierMults:       [1, 1.4, 2.0, 3.0],

    // Pulse
    pulseMaxCd:          14,     // base cooldown (seconds)
    pulseBaseForce:      850,    // knockback impulse magnitude
    pulseRingThickness:  26,     // hit-detection ring thickness (px)
    pulseRingSpeed:      380,    // ring expansion speed (px/s)
    pulseKillRechargeMin: 0.04,  // minimum CD reduction per kill
    pulseKillRechargeMax: 0.12,  // maximum CD reduction per kill

    // Enemy → tower damage
    enemyTowerDmgBase:   7,      // HP lost when enemy reaches tower
    exploderTowerDmg:    8,      // extra HP lost on exploder burst

    // Spawn director hard limits (difficulty only multiplies within these)
    spawnIntervalMin:    0.18,   // fastest spawn gap (s) — late game is frenetic
    spawnIntervalMax:    1.45,   // slowest spawn gap (s)
    enemyCapMin:         18,     // minimum live enemy cap
    enemyCapMax:         90,     // maximum live enemy cap (getEnemyCap allows 120)

    // Boss
    bossThresholds:      [1200, 2500, 4200, 6500, 9500],
    bossTimer:           30,
  };

  // ── SAFE BOUNDS for preset overrides ─────────────────────────────────
  const BOUNDS = {
    towerHp:              [10,  600 ],
    towerRegenAmount:     [0,   2   ],
    enemyHpMult:          [0.1, 20  ],  // allow deep scaling
    enemySpeedMult:       [0.1, 8   ],  // allow deep scaling
    spawnIntervalMult:    [0.05,5   ],
    enemyCapMult:         [0.1, 6   ],
    pulseCooldownMult:    [0.1, 4   ],
    projectileDamageMult: [0.1, 10  ],
    ramDamageBase:        [0,   5   ],
    scoreMult:            [0,   20  ],
  };

  // ── DIFFICULTY PRESETS ────────────────────────────────────────────────
  // preferredBrand: auto-switch to this brand when difficulty is chosen
  //                 (unless user has locked theme).
  const PRESETS = {
    EASY: {
      label:               'EASY',
      towerHp:             150,
      towerRegenAmount:    0.10,
      enemyHpMult:         0.65,
      enemySpeedMult:      0.72,
      spawnIntervalMult:   1.55,
      enemyCapMult:        0.70,
      pulseCooldownMult:   0.65,
      projectileDamageMult:1.40,
      ramDamageBase:       0.55,
      scoreMult:           0.75,
      preferredBrand:      'mcdo',
    },
    MEDIUM: {
      label:               'MEDIUM',
      towerHp:             100,
      towerRegenAmount:    0.04,
      enemyHpMult:         1.00,
      enemySpeedMult:      1.00,
      spawnIntervalMult:   1.00,
      enemyCapMult:        1.00,
      pulseCooldownMult:   1.00,
      projectileDamageMult:1.00,
      ramDamageBase:       0.35,
      scoreMult:           1.00,
      preferredBrand:      'perf',
    },
    HARD: {
      label:               'HARD',
      towerHp:             70,
      towerRegenAmount:    0.018,
      enemyHpMult:         1.45,
      enemySpeedMult:      1.30,
      spawnIntervalMult:   0.72,
      enemyCapMult:        1.35,
      pulseCooldownMult:   1.40,
      projectileDamageMult:0.85,
      ramDamageBase:       0.35,
      scoreMult:           1.60,
      preferredBrand:      'spaceopera',
    },
  };

  // ── Internal state ────────────────────────────────────────────────────
  let _active      = 'MEDIUM';
  let _themeLocked = false;

  function _load() {
    try {
      const d = localStorage.getItem('psd_difficulty');
      if (d && PRESETS[d]) _active = d;
      _themeLocked = localStorage.getItem('psd_theme_locked') === '1';
    } catch (_) {}
  }

  function _save() {
    try {
      localStorage.setItem('psd_difficulty', _active);
      localStorage.setItem('psd_theme_locked', _themeLocked ? '1' : '0');
    } catch (_) {}
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Tuning.get(key) → current value for key, clamped to safe bounds.
   *
   * Absolute-override keys (preset provides the final value):
   *   towerHp · towerRegenAmount · ramDamageBase
   *
   * Multiplier keys (game code multiplies its internal curve by this):
   *   enemyHpMult · enemySpeedMult · spawnIntervalMult · enemyCapMult
   *   pulseCooldownMult · projectileDamageMult · scoreMult
   *
   * Pure-base keys (constant, not affected by difficulty):
   *   playerFireRate · dartSpeedBase · pulseMaxCd · pulseBaseForce
   *   pulseRingThickness · pulseRingSpeed · pulseKillRechargeMin/Max
   *   enemyTowerDmgBase · exploderTowerDmg · towerRegenInterval
   *   towerHealMax · towerHealBase · towerHealThreshold
   *   spawnIntervalMin/Max · enemyCapMin/Max · bossThresholds · bossTimer
   */
  function get(key) {
    const p = PRESETS[_active];

    // Absolute overrides — preset specifies the exact final value
    if (['towerHp', 'towerRegenAmount', 'ramDamageBase'].includes(key)) {
      const b = BOUNDS[key];
      return b ? _c(p[key], b[0], b[1]) : p[key];
    }

    // Multiplier keys from preset with bounds
    if (['enemyHpMult','enemySpeedMult','spawnIntervalMult','enemyCapMult',
         'pulseCooldownMult','projectileDamageMult','scoreMult'].includes(key)) {
      const b = BOUNDS[key];
      return b ? _c(p[key], b[0], b[1]) : p[key];
    }

    // Everything else from BASE
    if (Object.prototype.hasOwnProperty.call(BASE, key)) return BASE[key];

    console.warn('[Tuning] Unknown key:', key);
    return 0;
  }

  function getDifficulty()         { return _active; }
  function isThemeLocked()         { return _themeLocked; }
  function setThemeLock(locked)    { _themeLocked = !!locked; _save(); }
  function getPresetNames()        { return Object.keys(PRESETS); }
  function getPreset(name)         { return PRESETS[name] || PRESETS.MEDIUM; }

  /**
   * setDifficulty(name)
   * Returns true = changes are live immediately.
   * Returns false = unknown difficulty (no-op).
   * Dispatches 'difficultyChanged'. Caller should show restart toast.
   */
  function setDifficulty(name) {
    if (!PRESETS[name]) {
      console.warn('[Tuning] Unknown difficulty:', name);
      return false;
    }
    _active = name;
    _save();

    if (!_themeLocked && window.BrandEngine) {
      const preferred = PRESETS[name].preferredBrand;
      if (preferred) {
        const ids = window.BrandEngine.getBrands().map(b => b.id);
        window.BrandEngine.applyBrand(ids.includes(preferred) ? preferred : 'default');
      }
    }

    window.dispatchEvent(new CustomEvent('difficultyChanged', { detail: { name } }));
    return true;
  }

  /** Called once during page startup after BrandEngine.init() */
  function init() {
    _load();
    // Apply preferred brand for the restored difficulty (respects theme lock)
    if (!_themeLocked && window.BrandEngine) {
      const preferred = PRESETS[_active].preferredBrand;
      if (preferred) {
        const ids = window.BrandEngine.getBrands().map(b => b.id);
        if (ids.includes(preferred)) window.BrandEngine.applyBrand(preferred);
      }
    }
    console.log('[Tuning] Difficulty:', _active, '| Theme locked:', _themeLocked);
  }

  return { get, getDifficulty, isThemeLocked, setThemeLock,
           setDifficulty, getPresetNames, getPreset, init,
           BASE, PRESETS };
})();
