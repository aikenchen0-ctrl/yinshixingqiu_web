export function normalizePopupAssetUrls(html) {
  return html.replaceAll(/(["'])\/assets\//g, '$1../../assets/');
}

export function normalizeRuntimeAssetUrls(source) {
  return source
    .replaceAll('chrome.runtime.getURL("assets/', 'chrome.runtime.getURL("dist/assets/')
    .replaceAll("chrome.runtime.getURL('assets/", "chrome.runtime.getURL('dist/assets/");
}
