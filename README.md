# Plasma Sheet Defense — Modular Brand World Engine

A canvas tower-defense game with a **plug-and-play brand integration system**.  
Drop one file into `/brands/` → brand appears in the game. Delete it → brand vanishes.  
Zero edits to core game code required.

---

## Quick Start

```bash
npm run brands   # regenerate brands/manifest.json
npx serve .      # local dev server → http://localhost:8080
```

Or open `index.html` from any static host (GitHub Pages, Netlify, Vercel).

---

## File Structure

```
/
├── index.html                    ← shell, loads everything
├── package.json
├── core/
│   ├── brand-schema.js           ← validation + defaults
│   ├── brand-engine.js           ← registry, CSS injection, brand row UI
│   └── game.js                   ← all game logic (no brand names hardcoded)
├── brands/
│   ├── manifest.json             ← AUTO-GENERATED (never edit by hand)
│   ├── default.brand.js
│   ├── spacetech.brand.js
│   ├── mcdo.brand.js
│   ├── watch.brand.js
│   ├── fmcg.brand.js
│   └── mondelez.brand.js
├── scripts/
│   └── gen-manifest.js           ← manifest generator
└── .github/
    └── workflows/
        └── brand-manifest.yml    ← auto-regenerates manifest on push
```

---

## How to Add a New Brand

### Step 1 — Create `/brands/mybrand.brand.js`

```js
BrandEngine.registerBrand({
  id: 'mybrand',          // must be unique, no spaces
  displayName: 'MY BRAND',

  palette: {
    accent:       '#ff6600',
    accentRgb:    '255,102,0',
    accentGlow:   'rgba(255,102,0,.8)',
    accent2:      '#ffcc00',
    gridColor:    '#330800',
    shipGlow:     '#ff6600',
    shipCore:     '#ffaa44',
    pulseColor:   'rgba(255,102,0,',
    projColors:   ['#ff6600','#ffcc00','#ff3300','#ffffff'],
    towerColors:  ['#1a0800','#2a1000','#3a1800','#4a2200'],
    particleColor: '#ff6600',
  },

  typography: { hudFont: 'Orbitron,sans-serif' },

  background: {
    layers: [
      ['#1a0400','#100300','#080200'],
      ['#220600','#180400','#0e0200'],
      ['#2a0800','#200600','#160300'],
      ['#320a00','#280800','#1c0500'],
    ],
  },

  enemies: {
    skins: {
      runner: '🔥', tank: '💪', splitter: '💥',
      // ... any enemy type can have a skin glyph
    },
  },

  pulse: { label: 'FIRE BURST', style: 'burst' },

  audio: {
    bpmBase: 128,
    pulseExtraFreqs: [
      { freq: 440, dur: 0.12, type: 'sawtooth', vol: 0.10 },
    ],
  },

  behavior: { spiralEmphasis: 1.2, dodgeStyle: 'aggressive' },
});
```

All unspecified fields inherit sensible defaults from `brand-schema.js`.

### Step 2 — Regenerate the manifest

**Locally:**
```bash
npm run brands
```

**Or push and let GitHub Actions do it automatically** — the workflow triggers on any `*.brand.js` change.

### Step 3 — Commit and push

```bash
git add brands/mybrand.brand.js
git commit -m "feat: add MyBrand integration"
git push
```

The GitHub Action will commit `brands/manifest.json` automatically.  
The brand will appear in the **PAUSED → BRAND selector** immediately.

---

## Removing a Brand

```bash
git rm brands/mybrand.brand.js
git commit -m "remove MyBrand"
git push
```

The Action regenerates the manifest. The brand disappears from the selector.  
If it was the active saved brand, the game falls back to `default` automatically.

---

## Brand Schema Reference

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique brand identifier |
| `displayName` | string | Shown in pause menu |
| `palette.accent` | `#rrggbb` | Primary accent colour |
| `palette.accentRgb` | `'r,g,b'` | Same colour as r,g,b for CSS var |
| `palette.projColors` | string[4] | Projectile colour tiers 1–4 |
| `palette.towerColors` | string[4] | Tower layer colours |
| `palette.particleColor` | `#rrggbb\|null` | Particle colour (null = enemy colour) |
| `background.layers` | string[4][3] | 4 phase bg gradients, each [c0,c1,c2] |
| `enemies.skins` | `{type: emoji}` | Overlay glyph on each enemy type |
| `enemies.colorOverrides` | `{type: color}` | Override enemy base colour |
| `pulse.label` | string | Effect name shown in HUD |
| `pulse.style` | `'ring'\|'ripple'\|'burst'` | Visual rendering of pulse ring |
| `projectile.style` | `'dart'\|'fry'\|'droplet'\|'gear'` | Projectile shape |
| `audio.bpmBase` | number | Base BPM for music engine |
| `audio.pulseExtraFreqs` | `{freq,dur,type,vol}[]` | Extra tones on pulse trigger |
| `behavior.spiralEmphasis` | 0.5–1.5 | Strength of spiral-hunter spiral motion |
| `behavior.dodgeStyle` | `'default'\|'aggressive'` | Enemy dodge aggressiveness |

---

## How It Works (Technical)

1. `index.html` loads `core/brand-schema.js` + `core/brand-engine.js` synchronously.
2. It `fetch`es `brands/manifest.json` and dynamically injects `<script>` tags for each brand file.
3. Each brand file calls `BrandEngine.registerBrand({...})`.
4. After all brand scripts load, `BrandEngine.init()` restores the saved brand from localStorage and calls `buildBrandRow()` to populate the pause-menu selector.
5. `core/game.js` loads last. `T()` inside the game delegates to `BrandEngine.getLegacyTheme()`, returning a flat object that matches the original theme shape — no other code changed.

Adding a brand never requires touching `index.html`, `game.js`, `brand-engine.js`, or `brand-schema.js`.
