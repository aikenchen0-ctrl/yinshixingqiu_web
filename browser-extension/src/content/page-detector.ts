import { WECHAT_EDITOR_HOST, WECHAT_EDITOR_PATH } from '../shared/constants'

function isWechatEditorUrl(url: URL) {
  return url.pathname === WECHAT_EDITOR_PATH && url.searchParams.get('t') === 'media/appmsg_edit'
}

function isWechatPublicArticleUrl(url: URL) {
  return url.pathname === '/s' || url.pathname.startsWith('/s/') || url.pathname === '/mp/appmsg/show'
}

export function isSupportedWechatArticleUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    return url.hostname === WECHAT_EDITOR_HOST && (isWechatEditorUrl(url) || isWechatPublicArticleUrl(url))
  } catch {
    return false
  }
}
