function normalizeArticleCount(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

function buildArticleSourceTabs(activeContentSource, wechatCount, planetCount) {
  const normalizedActiveContentSource = activeContentSource === 'planet' ? 'planet' : 'wechat'
  const normalizedWechatCount = normalizeArticleCount(wechatCount)
  const normalizedPlanetCount = normalizeArticleCount(planetCount)

  return [
    {
      key: 'wechat',
      label: '微信文章',
      meta: `${normalizedWechatCount}篇`,
      active: normalizedActiveContentSource === 'wechat',
      disabled: false,
    },
    {
      key: 'planet',
      label: '知识星球',
      meta: `${normalizedPlanetCount}篇`,
      active: normalizedActiveContentSource === 'planet',
      disabled: false,
    },
  ]
}

function buildArticleListRequest(contentSource, sessionToken) {
  const payload = {
    contentSource: contentSource === 'planet' ? 'planet' : 'wechat',
    status: 'PUBLISHED',
    page: 1,
    pageSize: 50,
  }

  if (sessionToken) {
    payload.sessionToken = sessionToken
  }

  return payload
}

function mapWechatArticleCardsFromResponse(responseData, input) {
  const responseItems = responseData && Array.isArray(responseData.items) ? responseData.items : []
  return input.sortArticleCards(responseItems.map((item) => input.mapRemoteArticleToCard(item)))
}

function assertWechatArticle(article) {
  if (!article || article.contentSource !== 'wechat') {
    throw new Error('该文章暂不对外展示')
  }

  return article
}

function buildArticleDetailShareOptions(input) {
  const articleId = input && input.articleId ? String(input.articleId).trim() : ''
  const source = input && input.source === 'planet' ? 'planet' : 'wechat'
  const shareImageKey = input && input.shareImageKey ? String(input.shareImageKey).trim() : ''
  const shareImageIndex = input && Number.isInteger(input.shareImageIndex) && input.shareImageIndex >= 0 ? input.shareImageIndex : -1
  const article = input && input.article ? input.article : {}
  const title = article && article.title ? String(article.title).trim() : ''
  const shareImageCandidates =
    article && Array.isArray(article.shareImageCandidates)
      ? article.shareImageCandidates.map((item) => String(item || '').trim()).filter(Boolean)
      : []
  const coverImage =
    shareImageCandidates[0] || (article && article.coverImage ? String(article.coverImage).trim() : '')

  const query = []
  if (articleId) {
    query.push(`id=${encodeURIComponent(articleId)}`)
  }
  query.push(`source=${source}`)
  if (shareImageKey) {
    query.push(`shareImageKey=${encodeURIComponent(shareImageKey)}`)
  }
  if (shareImageIndex >= 0) {
    query.push(`shareImageIndex=${shareImageIndex}`)
  }

  const path = `/pages/articles/detail?${query.join('&')}`

  const shareOptions = {
    title: title || (source === 'planet' ? '知识星球文章' : '微信文章'),
    path,
  }

  if (coverImage) {
    shareOptions.imageUrl = coverImage
  }

  return shareOptions
}

function buildArticleDetailShareLinkValue(input) {
  return buildArticleDetailShareOptions(input).path
}

const ARTICLE_IMAGE_TAG_PATTERN = /<img\b[^>]*?\b(?:src|data-src)\s*=\s*(['"])(.*?)\1[^>]*>/gi

function normalizeArticleShareImageCandidates(candidates) {
  return Array.isArray(candidates)
    ? candidates.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function buildArticleShareImageKey(imageUrl) {
  const normalizedImageUrl = String(imageUrl || '').trim()
  if (!normalizedImageUrl) {
    return ''
  }

  let hash = 2166136261
  for (let index = 0; index < normalizedImageUrl.length; index += 1) {
    hash ^= normalizedImageUrl.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `img_${(hash >>> 0).toString(36)}`
}

function buildArticleShareImageEntries(candidates) {
  const normalizedCandidates = normalizeArticleShareImageCandidates(candidates)
  const usedKeys = new Set()

  return normalizedCandidates.map((imageUrl, index) => {
    const baseImageKey = buildArticleShareImageKey(imageUrl) || `img_${index}`
    let imageKey = baseImageKey

    if (usedKeys.has(imageKey)) {
      imageKey = `${baseImageKey}_${index}`
    }

    usedKeys.add(imageKey)

    return {
      id: `share-image-${index}`,
      imageUrl,
      imageKey,
      imageIndex: index,
    }
  })
}

function resolveArticleShareTargetIndex(input) {
  const normalizedInput = input && typeof input === 'object' ? input : {}
  const shareImageKey = String(normalizedInput.shareImageKey || '').trim()
  const shareImageIndex = Number(normalizedInput.shareImageIndex)
  const imageKeys = Array.isArray(normalizedInput.imageKeys)
    ? normalizedInput.imageKeys.map((item) => String(item || '').trim())
    : []

  if (shareImageKey) {
    const resolvedIndex = imageKeys.indexOf(shareImageKey)
    if (resolvedIndex >= 0) {
      return resolvedIndex
    }
  }

  return Number.isInteger(shareImageIndex) && shareImageIndex >= 0 ? shareImageIndex : -1
}

function buildArticleShareScrollRetryDelays() {
  return [32, 2000]
}

function shouldRetryArticleShareScrollAfterMeasure(input) {
  const normalizedInput = input && typeof input === 'object' ? input : {}
  const previousAnchorTop = Number(normalizedInput.previousAnchorTop)
  const currentAnchorTop = Number(normalizedInput.currentAnchorTop)
  const shiftThreshold = Number.isFinite(Number(normalizedInput.shiftThreshold))
    ? Math.max(0, Number(normalizedInput.shiftThreshold))
    : 32
  const anchorTopThreshold = Number.isFinite(Number(normalizedInput.anchorTopThreshold))
    ? Math.max(0, Number(normalizedInput.anchorTopThreshold))
    : 160

  if (!Number.isFinite(currentAnchorTop)) {
    return false
  }

  if (currentAnchorTop >= anchorTopThreshold) {
    return true
  }

  if (!Number.isFinite(previousAnchorTop)) {
    return false
  }

  return Math.abs(currentAnchorTop - previousAnchorTop) >= shiftThreshold
}

function collectArticleShareImageCandidates(input) {
  const normalizedInput = input && typeof input === 'object' ? input : {}
  const richContent = String(normalizedInput.richContent || '')
  const bodyBlocks = Array.isArray(normalizedInput.bodyBlocks) ? normalizedInput.bodyBlocks : []
  const coverImage = String(normalizedInput.coverImage || '').trim()
  const candidates = []
  const seen = new Set()

  const appendCandidate = (value) => {
    const normalizedValue = String(value || '').trim()
    if (!normalizedValue || seen.has(normalizedValue)) {
      return
    }

    seen.add(normalizedValue)
    candidates.push(normalizedValue)
  }

  ARTICLE_IMAGE_TAG_PATTERN.lastIndex = 0
  let match = ARTICLE_IMAGE_TAG_PATTERN.exec(richContent)
  while (match) {
    appendCandidate(match[2])
    match = ARTICLE_IMAGE_TAG_PATTERN.exec(richContent)
  }

  bodyBlocks.forEach((block) => {
    if (block && block.type === 'wechat-card') {
      appendCandidate(block.coverImage)
    }
  })

  appendCandidate(coverImage)

  return candidates
}

function buildArticleSharePickerState(candidates) {
  return {
    selectedImage: '',
    items: buildArticleShareImageEntries(candidates),
  }
}

function annotateArticleRichContentWithShareAnchors(richContent, shareImageCandidates) {
  const normalizedRichContent = String(richContent || '').trim()
  const candidates = Array.isArray(shareImageCandidates)
    ? shareImageCandidates.map((item) => String(item || '').trim()).filter(Boolean)
    : []

  if (!normalizedRichContent || !candidates.length) {
    return {
      richContent: normalizedRichContent,
      targetAnchorIds: candidates.map(() => ''),
    }
  }

  const candidateIndexByUrl = new Map(candidates.map((imageUrl, index) => [imageUrl, index]))
  const targetAnchorIds = candidates.map(() => '')
  const usedAnchorIds = new Set()
  const IMAGE_TAG_PATTERN = /<img\b([^>]*?)\b(?:src|data-src)\s*=\s*(['"])(.*?)\2([^>]*)\/?>/gi

  const nextRichContent = normalizedRichContent.replace(IMAGE_TAG_PATTERN, (match, beforeAttrs, quote, imageUrl, afterAttrs) => {
    const normalizedImageUrl = String(imageUrl || '').trim()
    const imageIndex = candidateIndexByUrl.get(normalizedImageUrl)
    if (typeof imageIndex !== 'number') {
      return match
    }

    const anchorId = `article-share-anchor-${imageIndex}`
    if (usedAnchorIds.has(anchorId)) {
      return match
    }

    usedAnchorIds.add(anchorId)
    targetAnchorIds[imageIndex] = anchorId

    return `<section data-share-image-slot="${imageIndex}"></section>${match}`
  })

  return {
    richContent: nextRichContent,
    targetAnchorIds,
  }
}

const WECHAT_CARD_SLOT_PATTERN = /<section\b[^>]*data-wechat-card-slot=(['"]?)(\d+)\1[^>]*>\s*<\/section>/gi
const SHARE_IMAGE_SLOT_PATTERN = /<section\b[^>]*data-share-image-slot=(['"]?)(\d+)\1[^>]*>\s*<\/section>/gi

function normalizeWechatArticleCard(card) {
  if (!card || typeof card !== 'object') {
    return null
  }

  const normalizedIndex = Number(card.index)
  if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0) {
    return null
  }

  return {
    index: normalizedIndex,
    title: String(card.title || '').trim(),
    summary: String(card.summary || '').trim(),
    sourceUrl: String(card.sourceUrl || '').trim(),
    coverUrl: String(card.coverUrl || '').trim(),
  }
}

function buildArticleContentBlocks(richContent, metadata) {
  const normalizedRichContent = String(richContent || '').trim()
  if (!normalizedRichContent) {
    return []
  }

  const metadataRecord = metadata && typeof metadata === 'object' ? metadata : {}
  const rawCards = Array.isArray(metadataRecord.wechatArticleCards) ? metadataRecord.wechatArticleCards : []
  const cards = rawCards
    .map((item) => normalizeWechatArticleCard(item))
    .filter(Boolean)
  const cardByIndex = new Map(cards.map((item) => [item.index, item]))
  const slotMatches = []

  WECHAT_CARD_SLOT_PATTERN.lastIndex = 0
  let match = WECHAT_CARD_SLOT_PATTERN.exec(normalizedRichContent)
  while (match) {
    slotMatches.push({
      kind: 'wechat-card',
      index: match.index,
      length: match[0].length,
      slotIndex: Number(match[2]),
    })
    match = WECHAT_CARD_SLOT_PATTERN.exec(normalizedRichContent)
  }

  SHARE_IMAGE_SLOT_PATTERN.lastIndex = 0
  match = SHARE_IMAGE_SLOT_PATTERN.exec(normalizedRichContent)
  while (match) {
    slotMatches.push({
      kind: 'share-image',
      index: match.index,
      length: match[0].length,
      slotIndex: Number(match[2]),
    })
    match = SHARE_IMAGE_SLOT_PATTERN.exec(normalizedRichContent)
  }

  const normalizedSlotMatches = slotMatches.sort((left, right) => left.index - right.index)
  if (!normalizedSlotMatches.length) {
    return [
      {
        type: 'rich',
        html: normalizedRichContent,
        anchorId: '',
      },
    ]
  }

  const blocks = []
  let cursor = 0
  let pendingRichAnchorId = ''
  const pushRichBlock = (html, anchorId) => {
    const normalizedHtml = String(html || '').trim()
    if (!normalizedHtml) {
      return
    }

    blocks.push({
      type: 'rich',
      html: normalizedHtml,
      anchorId: String(anchorId || '').trim(),
    })
  }

  normalizedSlotMatches.forEach((slotMatch) => {
    const leadingHtml = normalizedRichContent.slice(cursor, slotMatch.index)

    if (slotMatch.kind === 'share-image') {
      pushRichBlock(leadingHtml, pendingRichAnchorId)
      pendingRichAnchorId = `article-share-anchor-${slotMatch.slotIndex}`
      cursor = slotMatch.index + slotMatch.length
      return
    }

    pushRichBlock(leadingHtml, pendingRichAnchorId)
    pendingRichAnchorId = ''

    const card = cardByIndex.get(slotMatch.slotIndex)
    if (card) {
      blocks.push({
        type: 'wechat-card',
        card,
      })
    }

    cursor = slotMatch.index + slotMatch.length
  })

  pushRichBlock(normalizedRichContent.slice(cursor), pendingRichAnchorId)

  return blocks
}

module.exports = {
  assertWechatArticle,
  annotateArticleRichContentWithShareAnchors,
  buildArticleContentBlocks,
  buildArticleDetailShareLinkValue,
  buildArticleDetailShareOptions,
  buildArticleShareImageEntries,
  buildArticleShareScrollRetryDelays,
  buildArticleListRequest,
  buildArticleSharePickerState,
  buildArticleSourceTabs,
  buildWechatArticleListRequest: (sessionToken) => buildArticleListRequest('wechat', sessionToken),
  collectArticleShareImageCandidates,
  mapWechatArticleCardsFromResponse,
  resolveArticleShareTargetIndex,
  shouldRetryArticleShareScrollAfterMeasure,
}
