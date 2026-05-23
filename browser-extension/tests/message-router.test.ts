import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessageToActiveWechatTab } from '../src/background/message-router'

describe('sendMessageToActiveWechatTab', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends message directly when receiver exists', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true })
    const executeScript = vi.fn()
    const getManifest = vi.fn().mockReturnValue({
      content_scripts: [{ js: ['dist/assets/content.js'] }],
    })

    vi.stubGlobal('chrome', {
      tabs: {
        sendMessage,
      },
      scripting: {
        executeScript,
      },
      runtime: {
        getManifest,
      },
    })

    await expect(sendMessageToActiveWechatTab(7, { type: 'demo' })).resolves.toEqual({ ok: true })

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(executeScript).not.toHaveBeenCalled()
  })

  it('injects content script and retries when receiver does not exist', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error('Could not establish connection. Receiving end does not exist.'))
      .mockResolvedValueOnce({ ok: true, data: { id: 'article_001' } })
    const executeScript = vi.fn().mockResolvedValue(undefined)
    const getManifest = vi.fn().mockReturnValue({
      content_scripts: [{ js: ['dist/assets/content.js'] }],
    })

    vi.stubGlobal('chrome', {
      tabs: {
        sendMessage,
      },
      scripting: {
        executeScript,
      },
      runtime: {
        getManifest,
      },
    })

    await expect(sendMessageToActiveWechatTab(9, { type: 'demo' })).resolves.toEqual({
      ok: true,
      data: { id: 'article_001' },
    })

    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(executeScript).toHaveBeenCalledTimes(1)
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 9 },
      files: ['dist/assets/content.js'],
    })
  })
})
