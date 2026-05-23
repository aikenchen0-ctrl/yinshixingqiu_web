import { describe, expect, it } from 'vitest';

import { normalizePopupAssetUrls, normalizeRuntimeAssetUrls } from '../scripts/popup-html-utils.mjs';

describe('normalizePopupAssetUrls', () => {
  it('rewrites popup asset urls to relative dist asset paths', () => {
    const input = `
<!doctype html>
<html>
  <head>
    <script type="module" src="/assets/popup.js"></script>
    <link rel="modulepreload" href="/assets/vendor.js">
    <link rel="stylesheet" href="/assets/popup.css">
  </head>
</html>`;

    const output = normalizePopupAssetUrls(input);

    expect(output).toContain('src="../../assets/popup.js"');
    expect(output).toContain('href="../../assets/vendor.js"');
    expect(output).toContain('href="../../assets/popup.css"');
    expect(output).not.toContain('"/assets/');
  });

  it('rewrites runtime asset urls for unpacked root extension loading', () => {
    const input = `
const mod = await import(
  chrome.runtime.getURL("assets/index.ts-abc.js")
)
const other = chrome.runtime.getURL('assets/helper.js')
`;

    const output = normalizeRuntimeAssetUrls(input);

    expect(output).toContain('chrome.runtime.getURL("dist/assets/index.ts-abc.js")');
    expect(output).toContain("chrome.runtime.getURL('dist/assets/helper.js')");
    expect(output).not.toContain('chrome.runtime.getURL("assets/');
  });
});
