import { createWechatArticle } from '../shared/api-client'
import { sendMessageToActiveWechatTab } from './message-router'
import { runWechatArticleSync } from './sync-service'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'popup/run-sync' || typeof message.tabId !== 'number') {
    return
  }

  void (async () => {
    try {
      const result = await runWechatArticleSync({
        tabId: message.tabId,
        sendTabMessage: (tabId, payload) => sendMessageToActiveWechatTab(tabId, payload),
        createArticle: createWechatArticle,
      })

      sendResponse({ ok: true, data: result })
    } catch (error) {
      sendResponse({ ok: false, message: error instanceof Error ? error.message : '同步失败' })
    }
  })()

  return true
})
