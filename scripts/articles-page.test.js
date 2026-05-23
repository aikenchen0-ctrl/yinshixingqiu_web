const test = require('node:test')
const assert = require('node:assert/strict')

const {
  annotateArticleRichContentWithShareAnchors,
  buildArticleListRequest,
  buildArticleSourceTabs,
  buildArticleDetailShareOptions,
  buildArticleDetailShareLinkValue,
  buildArticleShareImageEntries,
  buildArticleSharePickerState,
  buildArticleShareScrollRetryDelays,
  buildArticleContentBlocks,
  collectArticleShareImageCandidates,
  resolveArticleShareTargetIndex,
  shouldRetryArticleShareScrollAfterMeasure,
  assertWechatArticle,
  mapWechatArticleCardsFromResponse,
} = require('../miniprogram/pages/articles/shared')

test('buildArticleListRequest targets published wechat articles by default', () => {
  assert.deepEqual(buildArticleListRequest('wechat'), {
    contentSource: 'wechat',
    status: 'PUBLISHED',
    page: 1,
    pageSize: 50,
  })

  assert.deepEqual(buildArticleListRequest('wechat', 'session_123'), {
    contentSource: 'wechat',
    status: 'PUBLISHED',
    page: 1,
    pageSize: 50,
    sessionToken: 'session_123',
  })
})

test('buildArticleListRequest supports published planet articles', () => {
  assert.deepEqual(buildArticleListRequest('planet'), {
    contentSource: 'planet',
    status: 'PUBLISHED',
    page: 1,
    pageSize: 50,
  })
})

test('mapWechatArticleCardsFromResponse maps and sorts only response items', () => {
  const mapped = mapWechatArticleCardsFromResponse(
    {
      items: [{ id: 'a2' }, { id: 'a1' }],
    },
    {
      mapRemoteArticleToCard(item) {
        return {
          id: item.id,
          sortWeight: item.id === 'a2' ? 2 : 1,
        }
      },
      sortArticleCards(items) {
        return items.slice().sort((left, right) => right.sortWeight - left.sortWeight)
      },
    }
  )

  assert.deepEqual(mapped, [
    { id: 'a2', sortWeight: 2 },
    { id: 'a1', sortWeight: 1 },
  ])
})

test('assertWechatArticle rejects non-wechat article detail payload', () => {
  assert.throws(
    () => assertWechatArticle({ id: 'p1', contentSource: 'planet' }),
    /该文章暂不对外展示/
  )

  assert.doesNotThrow(() => assertWechatArticle({ id: 'w1', contentSource: 'wechat' }))
})

test('buildArticleSourceTabs exposes two dynamic source tabs', () => {
  assert.deepEqual(buildArticleSourceTabs('planet', 6, 8), [
    {
      key: 'wechat',
      label: '微信文章',
      meta: '6篇',
      active: false,
      disabled: false,
    },
    {
      key: 'planet',
      label: '知识星球',
      meta: '8篇',
      active: true,
      disabled: false,
    },
  ])
})

test('buildArticleDetailShareOptions builds a wechat article share payload with cover image', () => {
  assert.deepEqual(
    buildArticleDetailShareOptions({
      articleId: 'article_123',
      source: 'wechat',
      article: {
        title: '小程序的微信文章 测试',
        coverImage: 'https://example.com/cover.png',
      },
    }),
    {
      title: '小程序的微信文章 测试',
      path: '/pages/articles/detail?id=article_123&source=wechat',
      imageUrl: 'https://example.com/cover.png',
    }
  )
})

test('buildArticleDetailShareOptions falls back safely when title or cover is missing', () => {
  assert.deepEqual(
    buildArticleDetailShareOptions({
      articleId: '',
      source: 'wechat',
      article: {
        title: '',
        coverImage: '',
      },
    }),
    {
      title: '微信文章',
      path: '/pages/articles/detail?source=wechat',
    }
  )
})

test('buildArticleDetailShareOptions prefers derived share image candidates over cover image', () => {
  assert.deepEqual(
    buildArticleDetailShareOptions({
      articleId: 'article_456',
      source: 'wechat',
      article: {
        title: '正文图片优先',
        coverImage: 'https://example.com/cover.png',
        shareImageCandidates: ['https://example.com/body-first.png', 'https://example.com/body-second.png'],
      },
    }),
    {
      title: '正文图片优先',
      path: '/pages/articles/detail?id=article_456&source=wechat',
      imageUrl: 'https://example.com/body-first.png',
    }
  )
})

test('buildArticleDetailShareOptions appends selected share image index into share path', () => {
  assert.deepEqual(
    buildArticleDetailShareOptions({
      articleId: 'article_789',
      source: 'wechat',
      shareImageKey: 'img_body_second',
      shareImageIndex: 2,
      article: {
        title: '自动定位图片',
        shareImageCandidates: ['https://example.com/body-first.png'],
      },
    }),
    {
      title: '自动定位图片',
      path: '/pages/articles/detail?id=article_789&source=wechat&shareImageKey=img_body_second&shareImageIndex=2',
      imageUrl: 'https://example.com/body-first.png',
    }
  )
})

test('buildArticleDetailShareLinkValue reuses the miniapp card path for copy action', () => {
  assert.equal(
    buildArticleDetailShareLinkValue({
      articleId: 'article_copy_1',
      source: 'wechat',
      shareImageKey: 'img_copy_target',
      shareImageIndex: 1,
      article: {
        title: '复制路径',
        shareImageCandidates: ['https://example.com/body-copy.png'],
      },
    }),
    '/pages/articles/detail?id=article_copy_1&source=wechat&shareImageKey=img_copy_target&shareImageIndex=1'
  )
})

test('buildArticleShareImageEntries generates stable image keys for candidates', () => {
  const firstPass = buildArticleShareImageEntries([
    'https://example.com/body-1.jpg',
    'https://example.com/body-2.jpg',
  ])
  const secondPass = buildArticleShareImageEntries([
    'https://example.com/body-1.jpg',
    'https://example.com/body-2.jpg',
  ])

  assert.deepEqual(firstPass, secondPass)
  assert.equal(firstPass.length, 2)
  assert.match(firstPass[0].imageKey, /^img_[a-z0-9]+$/)
  assert.notEqual(firstPass[0].imageKey, firstPass[1].imageKey)
})

test('resolveArticleShareTargetIndex prefers image key and falls back to index', () => {
  assert.equal(
    resolveArticleShareTargetIndex({
      shareImageKey: 'img_b',
      shareImageIndex: 0,
      imageKeys: ['img_a', 'img_b', 'img_c'],
    }),
    1
  )

  assert.equal(
    resolveArticleShareTargetIndex({
      shareImageKey: 'img_missing',
      shareImageIndex: 2,
      imageKeys: ['img_a', 'img_b', 'img_c'],
    }),
    2
  )

  assert.equal(
    resolveArticleShareTargetIndex({
      shareImageKey: '',
      shareImageIndex: -1,
      imageKeys: ['img_a', 'img_b', 'img_c'],
    }),
    -1
  )
})

test('buildArticleShareScrollRetryDelays includes an immediate and delayed retry', () => {
  assert.deepEqual(buildArticleShareScrollRetryDelays(), [32, 2000])
})

test('shouldRetryArticleShareScrollAfterMeasure retries when anchor still shifts or stays too low', () => {
  assert.equal(
    shouldRetryArticleShareScrollAfterMeasure({
      previousAnchorTop: 420,
      currentAnchorTop: 310,
    }),
    true
  )

  assert.equal(
    shouldRetryArticleShareScrollAfterMeasure({
      previousAnchorTop: 96,
      currentAnchorTop: 168,
    }),
    true
  )

  assert.equal(
    shouldRetryArticleShareScrollAfterMeasure({
      previousAnchorTop: 112,
      currentAnchorTop: 118,
    }),
    false
  )
})

test('buildArticleContentBlocks interleaves rich html and extracted wechat card blocks', () => {
  const blocks = buildArticleContentBlocks(
    '<p>卡片前正文</p><section data-wechat-card-slot="0"></section><p>卡片后正文</p>',
    {
      wechatArticleCards: [
        {
          index: 0,
          title: '卡片文章标题',
          summary: '',
          sourceUrl: 'https://mp.weixin.qq.com/s/card-target',
          coverUrl: 'https://mmbiz.qpic.cn/card-cover.png',
        },
      ],
    }
  )

  assert.deepEqual(blocks, [
    {
      type: 'rich',
      html: '<p>卡片前正文</p>',
      anchorId: '',
    },
    {
      type: 'wechat-card',
      card: {
        index: 0,
        title: '卡片文章标题',
        summary: '',
        sourceUrl: 'https://mp.weixin.qq.com/s/card-target',
        coverUrl: 'https://mmbiz.qpic.cn/card-cover.png',
      },
    },
    {
      type: 'rich',
      html: '<p>卡片后正文</p>',
      anchorId: '',
    },
  ])
})

test('buildArticleContentBlocks extracts body images into standalone blocks for scroll targeting', () => {
  assert.deepEqual(
    annotateArticleRichContentWithShareAnchors(
      '<p>图片前正文</p><img src="https://example.com/body-1.jpg" /><p>图片后正文</p>',
      ['https://example.com/body-1.jpg']
    ),
    {
      richContent:
        '<p>图片前正文</p><section data-share-image-slot="0"></section><img src="https://example.com/body-1.jpg" /><p>图片后正文</p>',
      targetAnchorIds: ['article-share-anchor-0'],
    }
  )
})

test('collectArticleShareImageCandidates prefers rich-content images before inline cards and cover', () => {
  assert.deepEqual(
    collectArticleShareImageCandidates({
      richContent:
        '<p>段落</p><img src="https://example.com/body-1.jpg" /><img data-src="https://example.com/body-2.jpg" />',
      bodyBlocks: [
        { type: 'wechat-card', coverImage: 'https://example.com/card.jpg' },
      ],
      coverImage: 'https://example.com/cover.jpg',
    }),
    [
      'https://example.com/body-1.jpg',
      'https://example.com/body-2.jpg',
      'https://example.com/card.jpg',
      'https://example.com/cover.jpg',
    ]
  )
})

test('collectArticleShareImageCandidates de-duplicates repeated and empty urls', () => {
  assert.deepEqual(
    collectArticleShareImageCandidates({
      richContent: '<img src="https://example.com/body.jpg" /><img src="https://example.com/body.jpg" />',
      bodyBlocks: [
        { type: 'wechat-card', coverImage: 'https://example.com/body.jpg' },
        { type: 'wechat-card', coverImage: '' },
        { type: 'rich', html: '<p>正文</p>' },
      ],
      coverImage: 'https://example.com/body.jpg',
    }),
    ['https://example.com/body.jpg']
  )
})

test('buildArticleSharePickerState creates selectable grid items with no default selection', () => {
  assert.deepEqual(
    buildArticleSharePickerState([
      'https://example.com/body-1.jpg',
      'https://example.com/body-2.jpg',
    ]),
    {
      selectedImage: '',
      items: [
        {
          id: 'share-image-0',
          imageUrl: 'https://example.com/body-1.jpg',
          imageKey: buildArticleShareImageEntries(['https://example.com/body-1.jpg', 'https://example.com/body-2.jpg'])[0].imageKey,
          imageIndex: 0,
        },
        {
          id: 'share-image-1',
          imageUrl: 'https://example.com/body-2.jpg',
          imageKey: buildArticleShareImageEntries(['https://example.com/body-1.jpg', 'https://example.com/body-2.jpg'])[1].imageKey,
          imageIndex: 1,
        },
      ],
    }
  )
})
