import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: '饮视微信文章同步',
  version: '0.1.0',
  action: {
    default_popup: 'src/popup/index.html',
    default_title: '提交到小程序的文章',
  },
  permissions: ['tabs', 'activeTab', 'scripting'],
  host_permissions: ['https://mp.weixin.qq.com/*', 'https://xueyinx.cn/*'],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://mp.weixin.qq.com/*'],
      js: ['src/content/index.ts'],
    },
  ],
})
