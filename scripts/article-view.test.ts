import test from 'node:test'
import assert from 'node:assert/strict'

import * as articleViewModule from '../miniprogram/utils/article-view.ts'

const articleView = (articleViewModule as { default?: unknown }).default || articleViewModule
const { buildRemoteArticleDetail } = articleView as typeof import('../miniprogram/utils/article-view')

test('buildRemoteArticleDetail keeps wechat body images in rich blocks and assigns scroll anchors', () => {
  const detail = buildRemoteArticleDetail({
    id: 'wechat-article-1',
    groupId: 'group-1',
    type: 'ARTICLE',
    status: 'PUBLISHED',
    title: '带图片的微信文章',
    summary: '摘要',
    contentText: '正文',
    contentSource: 'wechat',
    coverUrl: 'https://example.com/cover.jpg',
    richContent:
      '<p>图片前正文</p><img src="https://example.com/body-1.jpg" /><section data-wechat-card-slot="0"></section><p>图片后正文</p>',
    tags: [],
    authorDisplay: null,
    access: null,
    preview: null,
    attachments: [],
    isPinned: false,
    isEssence: false,
    readingCount: 12,
    likeCount: 0,
    commentCount: 0,
    publishedAt: '2025-01-01T00:00:00.000Z',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    metadata: {
      wechatArticleCards: [
        {
          index: 0,
          title: '相关文章',
          summary: '',
          sourceUrl: 'https://mp.weixin.qq.com/s/card-target',
          coverUrl: 'https://example.com/card.jpg',
        },
      ],
    },
  })

  assert.equal(detail.bodyBlocks.length, 4)
  assert.equal(detail.bodyBlocks[0]?.type, 'rich')
  assert.equal(detail.bodyBlocks[1]?.type, 'rich')
  assert.equal(detail.bodyBlocks[2]?.type, 'wechat-card')
  assert.equal(detail.bodyBlocks[3]?.type, 'rich')
  assert.equal(detail.bodyBlocks.some((block) => block.type === 'image'), false)

  assert.equal(detail.bodyBlocks[0]?.type === 'rich' ? detail.bodyBlocks[0].anchorId : '', '')
  assert.equal(detail.bodyBlocks[1]?.type === 'rich' ? detail.bodyBlocks[1].anchorId : '', 'article-share-anchor-0')
  assert.doesNotMatch(detail.bodyBlocks[1]?.type === 'rich' ? detail.bodyBlocks[1].html : '', /article-share-anchor-0/)
  assert.equal(detail.shareImageKeys.length, 3)
  assert.match(detail.shareImageKeys[0] || '', /^img_[a-z0-9]+$/)
  assert.deepEqual(detail.shareImageTargetAnchorIds, [
    'article-share-anchor-0',
    'article-share-anchor-1',
    '',
  ])
})

test('buildRemoteArticleDetail trims leading empty rich nodes to avoid top whitespace', () => {
  const detail = buildRemoteArticleDetail({
    id: 'wechat-article-2',
    groupId: 'group-2',
    type: 'ARTICLE',
    status: 'PUBLISHED',
    title: '顶部空白测试',
    summary: '',
    contentText: '正文',
    contentSource: 'wechat',
    coverUrl: '',
    richContent: '<p><br></p><p>&nbsp;</p><p>真正正文</p>',
    tags: [],
    authorDisplay: null,
    access: null,
    preview: null,
    attachments: [],
    isPinned: false,
    isEssence: false,
    readingCount: 0,
    likeCount: 0,
    commentCount: 0,
    publishedAt: '2025-01-01T00:00:00.000Z',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    metadata: {},
  })

  assert.equal(detail.bodyBlocks.length, 1)
  assert.equal(detail.bodyBlocks[0]?.type, 'rich')
  assert.equal(detail.bodyBlocks[0]?.type === 'rich' ? detail.bodyBlocks[0].html : '', '<p>真正正文</p>')
})
