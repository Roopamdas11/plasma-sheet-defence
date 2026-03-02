#!/usr/bin/env node
// scripts/gen-manifest.js
// ─────────────────────────────────────────────────────────────────────
// Scans /brands/*.brand.js and writes /brands/manifest.json.
//
// Usage (local):
//   node scripts/gen-manifest.js
//
// From package.json:
//   "scripts": { "brands": "node scripts/gen-manifest.js" }
//
// Run after adding or removing any .brand.js file, OR let the
// GitHub Action do it automatically on every push.
// ─────────────────────────────────────────────────────────────────────
'use strict';

const fs   = require('fs');
const path = require('path');

const BRANDS_DIR  = path.join(__dirname, '..', 'brands');
const MANIFEST_PATH = path.join(BRANDS_DIR, 'manifest.json');

// Collect all *.brand.js files
const files = fs.readdirSync(BRANDS_DIR)
  .filter(f => f.endsWith('.brand.js'))
  .sort(); // alphabetical; put 'default.brand.js' first if desired

// Extract the brand id (filename without .brand.js)
const brandIds = files.map(f => f.replace('.brand.js', ''));

// Put 'default' first if present
const defaultIdx = brandIds.indexOf('default');
if (defaultIdx > 0) {
  brandIds.splice(defaultIdx, 1);
  brandIds.unshift('default');
}

const manifest = {
  _comment: 'AUTO-GENERATED — do not edit by hand. Run: npm run brands OR push to trigger GitHub Action.',
  _generated: new Date().toISOString(),
  brands: brandIds,
};

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

console.log(`[gen-manifest] ✓ Written ${brandIds.length} brand(s) to brands/manifest.json:`);
brandIds.forEach(id => console.log(`  · ${id}`));
