import { describe, expect, it } from 'vitest'
import { isSupportedWechatArticleUrl } from '../src/content/page-detector'

describe('isSupportedWechatArticleUrl', () => {
  it('matches the wechat article editor page', () => {
    expect(
      isSupportedWechatArticleUrl(
        'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=100000028',
      ),
    ).toBe(true)
  })

  it('matches the public wechat article page', () => {
    expect(isSupportedWechatArticleUrl('https://mp.weixin.qq.com/s/AbCdEf1234567890')).toBe(true)
    expect(isSupportedWechatArticleUrl('https://mp.weixin.qq.com/s?__biz=MzA3&mid=2650&idx=1&sn=test')).toBe(true)
    expect(isSupportedWechatArticleUrl('https://mp.weixin.qq.com/mp/appmsg/show?__biz=MzA3&appmsgid=1')).toBe(true)
  })

  it('rejects unrelated wechat pages', () => {
    expect(isSupportedWechatArticleUrl('https://mp.weixin.qq.com/cgi-bin/home?t=home/index')).toBe(false)
  })

  it('rejects non-wechat pages', () => {
    expect(isSupportedWechatArticleUrl('https://example.com/article/edit')).toBe(false)
  })
})
