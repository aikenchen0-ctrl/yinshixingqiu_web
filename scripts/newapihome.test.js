const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const pageDir = path.join(rootDir, 'newapihome');

function read(file) {
  return fs.readFileSync(path.join(pageDir, file), 'utf8');
}

test('newapihome landing assets exist and reference each other', () => {
  const html = read('index.html');
  const css = read('styles.css');
  const js = read('script.js');

  assert.match(html, /<main class="landing-shell">/);
  assert.match(html, /<canvas class="particle-stage" id="particle-stage"/);
  assert.match(html, /<div class="floating-copy" id="floating-copy"/);
  assert.match(html, /<div class="model-ring" id="model-ring"/);
  assert.match(html, /<div class="pointer-aura" id="pointer-aura"/);
  assert.match(html, /<div class="hero-beam hero-beam-left"/);
  assert.match(html, /<div class="hero-beam hero-beam-right"/);
  assert.match(html, /<div class="brand-core-shell"/);
  assert.match(html, /<div class="brand-core-energy"/);
  assert.match(html, /<div class="hero-lens" aria-hidden="true"><\/div>/);
  assert.match(html, /<div class="core-orbit core-orbit-outer"/);
  assert.match(html, /<div class="model-spokes" id="model-spokes"/);
  assert.match(html, /<img class="brand-mark" src="\.\/logo\.svg"/);
  assert.match(html, /<script src="\.\/script\.js"><\/script>/);

  assert.match(css, /body\s*\{/);
  assert.match(css, /\.particle-stage/);
  assert.match(css, /\.floating-copy-item/);
  assert.match(css, /\.model-badge/);
  assert.match(css, /\.model-badge-icon/);
  assert.match(css, /\.pointer-aura/);
  assert.match(css, /\.hero-beam/);
  assert.match(css, /\.brand-core-shell/);
  assert.match(css, /\.brand-core-energy/);
  assert.match(css, /\.hero-lens/);
  assert.match(css, /\.core-orbit/);
  assert.match(css, /\.model-badge-accent/);
  assert.match(css, /\.model-spoke/);
  assert.match(css, /@keyframes floatDrift/);
  assert.match(css, /@keyframes ringPulse/);
  assert.match(css, /@keyframes beamSweep/);

  assert.match(js, /const COPY_ITEMS = \[/);
  assert.match(js, /const MODEL_LOGOS = \[/);
  assert.match(js, /function createModelBadgeIcon\(/);
  assert.match(js, /function updatePointerAura\(/);
  assert.match(js, /function updateHeroPerspective\(/);
  assert.match(js, /function createModelBadgeAccent\(/);
  assert.match(js, /function updateModelSpokes\(/);
  assert.match(js, /function updateAmbientDrift\(/);
  assert.match(js, /function renderParticleField\(/);
  assert.match(js, /function layoutModelRing\(/);
  assert.match(js, /function layoutCopyItems\(/);
});
