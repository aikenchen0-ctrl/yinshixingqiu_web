function isMissingReceiverError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return message.includes('Receiving end does not exist')
}

function getWechatContentScriptFiles() {
  const manifest = chrome.runtime.getManifest()
  const files =
    manifest.content_scripts?.find((entry) => Array.isArray(entry.js) && entry.js.length > 0)?.js || []

  return files
}

async function injectWechatContentScripts(tabId: number) {
  const files = getWechatContentScriptFiles()
  if (!files.length) {
    throw new Error('未找到可注入的微信文章内容脚本')
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files,
  })
}

export async function sendMessageToActiveWechatTab<T>(tabId: number, message: unknown) {
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as T
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error
    }

    await injectWechatContentScripts(tabId)
    return (await chrome.tabs.sendMessage(tabId, message)) as T
  }
}
