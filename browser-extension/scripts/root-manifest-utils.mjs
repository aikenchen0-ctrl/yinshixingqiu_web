function prefixDistPath(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }

  if (
    value.startsWith('dist/') ||
    value.startsWith('/') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('chrome://') ||
    value.startsWith('chrome-extension://')
  ) {
    return value;
  }

  return `dist/${value}`;
}

function prefixPathList(values) {
  if (!Array.isArray(values)) {
    return values;
  }

  return values.map((value) => prefixDistPath(value));
}

export function createRootManifest(distManifest) {
  const rootManifest = JSON.parse(JSON.stringify(distManifest));

  if (rootManifest.action?.default_popup) {
    rootManifest.action.default_popup = prefixDistPath(rootManifest.action.default_popup);
  }

  if (rootManifest.background?.service_worker) {
    rootManifest.background.service_worker = prefixDistPath(rootManifest.background.service_worker);
  }

  if (rootManifest.options_page) {
    rootManifest.options_page = prefixDistPath(rootManifest.options_page);
  }

  if (rootManifest.devtools_page) {
    rootManifest.devtools_page = prefixDistPath(rootManifest.devtools_page);
  }

  if (rootManifest.icons && typeof rootManifest.icons === 'object') {
    for (const size of Object.keys(rootManifest.icons)) {
      rootManifest.icons[size] = prefixDistPath(rootManifest.icons[size]);
    }
  }

  if (rootManifest.chrome_url_overrides && typeof rootManifest.chrome_url_overrides === 'object') {
    for (const key of Object.keys(rootManifest.chrome_url_overrides)) {
      rootManifest.chrome_url_overrides[key] = prefixDistPath(rootManifest.chrome_url_overrides[key]);
    }
  }

  if (Array.isArray(rootManifest.content_scripts)) {
    rootManifest.content_scripts = rootManifest.content_scripts.map((entry) => ({
      ...entry,
      js: prefixPathList(entry.js),
      css: prefixPathList(entry.css),
    }));
  }

  if (Array.isArray(rootManifest.web_accessible_resources)) {
    rootManifest.web_accessible_resources = rootManifest.web_accessible_resources.map((entry) => ({
      ...entry,
      resources: prefixPathList(entry.resources),
    }));
  }

  if (rootManifest.sandbox?.pages) {
    rootManifest.sandbox.pages = prefixPathList(rootManifest.sandbox.pages);
  }

  return rootManifest;
}
