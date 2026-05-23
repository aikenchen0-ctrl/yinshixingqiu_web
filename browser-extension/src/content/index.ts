import { SYNC_MESSAGE_TYPE } from '../shared/constants'
import { extractWechatArticleFromDocument } from './wechat-article-extractor'
import { isSupportedWechatArticleUrl } from './page-detector'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== SYNC_MESSAGE_TYPE) {
    return
  }

  if (!isSupportedWechatArticleUrl(window.location.href)) {
    sendResponse({ ok: false, message: '当前页面不是可同步的微信公众号文章页' })
    return
  }

  sendResponse({
    ok: true,
    data: extractWechatArticleFromDocument(document, { pageUrl: window.location.href }),
  })
})
