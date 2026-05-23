import { describe, expect, it } from 'vitest';

import { createRootManifest } from '../scripts/root-manifest-utils.mjs';

describe('createRootManifest', () => {
  it('prefixes build output paths so the root folder is loadable in Chrome', () => {
    const distManifest = {
      manifest_version: 3,
      name: 'demo',
      version: '0.1.0',
      action: {
        default_popup: 'src/popup/index.html',
      },
      background: {
        service_worker: 'service-worker-loader.js',
        type: 'module',
      },
      content_scripts: [
        {
          js: ['assets/content.js'],
          css: ['assets/content.css'],
          matches: ['https://mp.weixin.qq.com/*'],
        },
      ],
      web_accessible_resources: [
        {
          resources: ['assets/helper.js'],
          matches: ['https://mp.weixin.qq.com/*'],
        },
      ],
      host_permissions: ['https://mp.weixin.qq.com/*'],
    };

    const rootManifest = createRootManifest(distManifest);

    expect(rootManifest.action.default_popup).toBe('dist/src/popup/index.html');
    expect(rootManifest.background.service_worker).toBe('dist/service-worker-loader.js');
    expect(rootManifest.content_scripts[0].js).toEqual(['dist/assets/content.js']);
    expect(rootManifest.content_scripts[0].css).toEqual(['dist/assets/content.css']);
    expect(rootManifest.web_accessible_resources[0].resources).toEqual(['dist/assets/helper.js']);
    expect(rootManifest.host_permissions).toEqual(['https://mp.weixin.qq.com/*']);
  });
});
