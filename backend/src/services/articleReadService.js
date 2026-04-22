const { prisma } = require("../db/prisma");

const ARTICLE_RICH_BLOCK_PATTERN =
  /<(p|section|article|blockquote|ul|ol|li|h1|h2|h3|h4|h5|h6|pre|figure|div)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function escapeRichText(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitTextParagraphs(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toRichParagraphs(value) {
  return splitTextParagraphs(value)
    .map((item) => `<p>${escapeRichText(item)}</p>`)
    .join("");
}

function countRichContentBlocks(richContent) {
  const normalizedRichContent = normalizeString(richContent);
  if (!normalizedRichContent) {
    return 0;
  }

  const blocks = normalizedRichContent.match(ARTICLE_RICH_BLOCK_PATTERN);
  if (blocks && blocks.length) {
    return blocks.length;
  }

  const plainText = normalizedRichContent.replace(/<[^>]+>/g, "\n");
  return splitTextParagraphs(plainText).length;
}

function buildPreviewRichContentFromFull(richContent, previewMode, previewValue) {
  const normalizedRichContent = normalizeString(richContent);
  if (!normalizedRichContent) {
    return "";
  }

  const blocks = normalizedRichContent.match(ARTICLE_RICH_BLOCK_PATTERN);
  if (!blocks || !blocks.length) {
    return "";
  }

  const totalBlockCount = blocks.length;
  let previewCount = totalBlockCount;

  if (previewMode === "ratio") {
    const normalizedRatio = Math.max(0.1, Math.min(1, normalizeNumber(previewValue) || 0));
    previewCount = Math.max(1, Math.ceil(totalBlockCount * normalizedRatio));
  } else {
    previewCount = Math.max(1, Math.min(totalBlockCount, Math.floor(normalizeNumber(previewValue) || 0)));
  }

  return blocks.slice(0, previewCount).join("");
}

function buildPreviewParagraphs(fullParagraphs, previewText, previewMode, previewValue) {
  const explicitPreviewParagraphs = splitTextParagraphs(previewText);
  if (explicitPreviewParagraphs.length) {
    return explicitPreviewParagraphs;
  }

  if (!Array.isArray(fullParagraphs) || !fullParagraphs.length) {
    return [];
  }

  if (previewMode === "ratio") {
    const normalizedRatio = Math.max(0.1, Math.min(1, normalizeNumber(previewValue) || 0));
    const previewCount = Math.max(1, Math.ceil(fullParagraphs.length * normalizedRatio));
    return fullParagraphs.slice(0, previewCount);
  }

  const previewCount = Math.max(1, Math.min(fullParagraphs.length, Math.floor(normalizeNumber(previewValue) || 0)));
  return fullParagraphs.slice(0, previewCount);
}

function sanitizeMetadataForArticleReader(metadata, article, readAccess) {
  const nextMetadata = isPlainObject(metadata) ? { ...metadata } : {};
  const nextArticleAccess = isPlainObject(nextMetadata.articleAccess) ? { ...nextMetadata.articleAccess } : {};
  const nextArticlePreview = isPlainObject(nextMetadata.articlePreview) ? { ...nextMetadata.articlePreview } : {};
  const shouldHideMedia =
    article &&
    article.access &&
    article.access.accessType === "paid" &&
    readAccess &&
    readAccess.canReadFull !== true;

  nextMetadata.richContent = readAccess.visibleRichContent;
  nextMetadata.previewText = readAccess.previewContentText;
  nextMetadata.previewRichContent = readAccess.previewRichContent;
  nextMetadata.contentParagraphCount = readAccess.fullParagraphCount;
  nextMetadata.previewParagraphCount = readAccess.previewParagraphCount;
  nextMetadata.isUnlocked = readAccess.canReadFull;
  nextMetadata.articleAccess = {
    ...nextArticleAccess,
    ...(article.access || {}),
    isUnlocked: readAccess.canReadFull,
    contentParagraphCount: readAccess.fullParagraphCount,
    previewParagraphCount: readAccess.previewParagraphCount,
  };
  nextMetadata.articlePreview = {
    ...nextArticlePreview,
    ...(article.preview || {}),
    previewText: readAccess.previewContentText,
    previewRichContent: readAccess.previewRichContent,
  };

  if (shouldHideMedia) {
    nextMetadata.images = [];
    nextMetadata.videos = [];
    nextMetadata.videoAttachments = [];
    nextMetadata.fileAttachments = [];
    nextMetadata.hasVideo = false;
    nextMetadata.hasFile = false;
  }

  return nextMetadata;
}

function buildArticleReadAccess(article, source, viewerContext = {}) {
  const access = isPlainObject(article && article.access)
    ? {
        ...article.access,
      }
    : {
        accessType: "free",
        priceAmount: 0,
        priceLabel: "免费",
        isUnlocked: true,
        previewMode: "paragraph",
        previewValue: 1,
      };
  const preview = isPlainObject(article && article.preview) ? article.preview : {};
  const fullContentText = normalizeString(source && source.contentText);
  const fullParagraphs = splitTextParagraphs(fullContentText);
  const fullRichContent =
    normalizeString(source && source.richContent) || normalizeString(article && article.richContent) || toRichParagraphs(fullContentText);
  const previewParagraphs = buildPreviewParagraphs(
    fullParagraphs,
    preview.previewText,
    access.previewMode,
    access.previewValue
  );
  const previewContentText =
    normalizeString(preview.previewText) || (previewParagraphs.length ? previewParagraphs.join("\n") : fullParagraphs.join("\n"));
  const previewRichContent =
    normalizeString(preview.previewRichContent) ||
    buildPreviewRichContentFromFull(fullRichContent, access.previewMode, access.previewValue) ||
    toRichParagraphs(previewContentText);
  const viewerCanManage = Boolean(viewerContext.canManage);
  const viewerIsAuthor = Boolean(viewerContext.isAuthor);
  const viewerHasUnlock = Boolean(viewerContext.isUnlocked);
  const canReadFull = access.accessType === "free" || viewerHasUnlock || viewerIsAuthor || viewerCanManage;
  const visibleParagraphs = canReadFull ? fullParagraphs : previewParagraphs;
  const visibleContentText =
    canReadFull || !previewContentText ? fullContentText || visibleParagraphs.join("\n") : previewContentText;
  const visibleRichContent = canReadFull ? fullRichContent : previewRichContent || toRichParagraphs(visibleContentText);
  const fullParagraphCount = Math.max(
    0,
    Math.round(normalizeNumber(preview.contentParagraphCount) || normalizeNumber(access.contentParagraphCount) || 0) ||
      countRichContentBlocks(fullRichContent) ||
      fullParagraphs.length
  );
  const previewParagraphCount = access.accessType === "free"
    ? fullParagraphCount
    : Math.max(
        1,
        Math.min(
          fullParagraphCount || Number.MAX_SAFE_INTEGER,
          Math.round(normalizeNumber(preview.previewParagraphCount) || normalizeNumber(access.previewParagraphCount) || 0) ||
            countRichContentBlocks(previewRichContent) ||
            previewParagraphs.length ||
            1
        )
      );
  const visibleParagraphCount = canReadFull ? fullParagraphCount : previewParagraphCount;
  const hiddenParagraphCount = canReadFull ? 0 : Math.max(0, fullParagraphCount - visibleParagraphCount);
  const readState = access.accessType === "free" ? "free_full" : canReadFull ? "paid_unlocked" : "paid_locked";

  return {
    readState,
    canReadFull,
    visibleContentText,
    visibleParagraphs,
    visibleRichContent,
    previewContentText,
    previewParagraphs,
    previewRichContent,
    fullParagraphCount,
    previewParagraphCount,
    visibleParagraphCount,
    hiddenParagraphCount,
  };
}

function applyArticleReadAccessToDto(article, source, viewerContext, options = {}) {
  if (!article) {
    return null;
  }

  const readAccess = buildArticleReadAccess(article, source, viewerContext);
  const access = isPlainObject(article.access)
    ? {
        ...article.access,
        isUnlocked: readAccess.canReadFull,
        contentParagraphCount: readAccess.fullParagraphCount,
        previewParagraphCount: readAccess.previewParagraphCount,
      }
    : null;
  const preview = isPlainObject(article.preview)
    ? {
        ...article.preview,
        previewText: readAccess.previewContentText,
        previewRichContent: readAccess.previewRichContent,
        contentParagraphCount: readAccess.fullParagraphCount,
        previewParagraphCount: readAccess.previewParagraphCount,
      }
    : null;
  const shouldHideAttachments =
    access &&
    access.accessType === "paid" &&
    readAccess.canReadFull !== true;

  return {
    ...article,
    contentText: readAccess.visibleContentText,
    richContent: readAccess.visibleRichContent,
    access,
    preview,
    attachments: shouldHideAttachments ? [] : Array.isArray(article.attachments) ? article.attachments : [],
    metadata: sanitizeMetadataForArticleReader(article.metadata, { access, preview }, readAccess),
    readState: readAccess.readState,
    canReadFull: readAccess.canReadFull,
    fullParagraphCount: readAccess.fullParagraphCount,
    visibleParagraphCount: readAccess.visibleParagraphCount,
    hiddenParagraphCount: readAccess.hiddenParagraphCount,
    previewContentText: readAccess.previewContentText,
    previewRichContent: readAccess.previewRichContent,
    contentParagraphs: options.includeParagraphs ? readAccess.visibleParagraphs : [],
    previewParagraphs: options.includeParagraphs ? readAccess.previewParagraphs : [],
  };
}

async function loadViewerArticleUnlockIdSet(articleIds, viewerId, client = prisma) {
  const normalizedViewerId = normalizeString(viewerId);
  const uniqueArticleIds = Array.from(new Set((Array.isArray(articleIds) ? articleIds : []).map(normalizeString).filter(Boolean)));

  if (!normalizedViewerId || !uniqueArticleIds.length) {
    return new Set();
  }

  const unlocks = await client.articleUnlock.findMany({
    where: {
      userId: normalizedViewerId,
      articleId: {
        in: uniqueArticleIds,
      },
    },
    select: {
      articleId: true,
    },
  });

  return new Set(unlocks.map((item) => normalizeString(item.articleId)).filter(Boolean));
}

module.exports = {
  applyArticleReadAccessToDto,
  loadViewerArticleUnlockIdSet,
};
