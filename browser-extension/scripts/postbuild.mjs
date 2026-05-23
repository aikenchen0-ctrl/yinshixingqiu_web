import { createRootManifest } from './root-manifest-utils.mjs';
import { readdir, readFile, writeFile } from 'node:fs/promises';

import { normalizePopupAssetUrls, normalizeRuntimeAssetUrls } from './popup-html-utils.mjs';

const popupHtmlPath = new URL('../dist/src/popup/index.html', import.meta.url);
const distManifestPath = new URL('../dist/manifest.json', import.meta.url);
const rootManifestPath = new URL('../manifest.json', import.meta.url);
const distAssetsPath = new URL('../dist/assets/', import.meta.url);

const popupHtml = await readFile(popupHtmlPath, 'utf8');
const normalizedPopupHtml = normalizePopupAssetUrls(popupHtml);
await writeFile(popupHtmlPath, normalizedPopupHtml, 'utf8');

const distAssetEntries = await readdir(distAssetsPath, { withFileTypes: true });
for (const entry of distAssetEntries) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) {
    continue;
  }

  const assetUrl = new URL(`../dist/assets/${entry.name}`, import.meta.url);
  const assetSource = await readFile(assetUrl, 'utf8');
  const normalizedAssetSource = normalizeRuntimeAssetUrls(assetSource);
  if (normalizedAssetSource !== assetSource) {
    await writeFile(assetUrl, normalizedAssetSource, 'utf8');
  }
}

const distManifest = JSON.parse(await readFile(distManifestPath, 'utf8'));
const rootManifest = createRootManifest(distManifest);
await writeFile(rootManifestPath, `${JSON.stringify(rootManifest, null, 2)}\n`, 'utf8');

console.log('Normalized popup/runtime asset urls and wrote root manifest.json.');
