const { prisma } = require("../db/prisma");
const { buildArticlePayload, normalizeArticleMetadataShape } = require("./articleModelService");
const { getPostDetail, createPost, updatePost, resolveViewerIdentity, getGroupManagerAccess } = require("./contentService");
const { updateAdminContent } = require("./adminService");
const { loadViewerArticleUnlockIdSet } = require("./articleReadService");

const ARTICLE_RICH_BLOCK_PATTERN =
  /<(p|section|article|blockquote|ul|ol|li|h1|h2|h3|h4|h5|h6|pre|figure|div)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;

function normalizeString(value) {
  return String(value || "").trim();
}

function parsePositiveInt(value, fallback, maxValue) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), maxValue);
}

function toIso(value) {
  return value ? new Date(value).toISOString() : "";
}

function normalizeStatus(value) {
  const normalizedValue = normalizeString(value).toUpperCase();
  if (normalizedValue === "ALL") {
    return "ALL";
  }

  return ["DRAFT", "PUBLISHED", "HIDDEN", "DELETED"].includes(normalizedValue) ? normalizedValue : "";
}

function normalizeContentSource(value) {
  const normalizedValue = normalizeString(value).toLowerCase();
  if (normalizedValue === "wechat") {
    return "wechat";
  }

  if (normalizedValue === "planet") {
    return "planet";
  }

  return "";
}

function normalizeAccessType(value) {
  const normalizedValue = normalizeString(value).toLowerCase();
  if (normalizedValue === "free") {
    return "free";
  }

  if (normalizedValue === "paid") {
    return "paid";
  }

  return "";
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeBooleanFlag(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = normalizeString(value).toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalizedValue)) {
    return true;
  }

  if (["0", "false", "no", "n"].includes(normalizedValue)) {
    return false;
  }

  return fallback;
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isArticleRestrictedForPublic(metadata, postStatus) {
  const reviewStatus = normalizeString(metadata.reviewStatus).toUpperCase();
  return postStatus !== "PUBLISHED" || reviewStatus === "PENDING" || reviewStatus === "REJECTED";
}

function buildArticleWriteMetadata(input = {}) {
  const metadata = {
    ...(isPlainObject(input.metadata) ? input.metadata : {}),
    publishType: "article",
  };

  if (input.contentSource !== undefined) {
    metadata.contentSource = input.contentSource;
  }

  if (input.coverUrl !== undefined) {
    metadata.coverUrl = input.coverUrl;
  }

  if (input.richContent !== undefined) {
    metadata.richContent = input.richContent;
  }

  if (input.tags !== undefined) {
    metadata.tags = Array.isArray(input.tags) ? input.tags : [];
  }

  if (isPlainObject(input.authorDisplay)) {
    metadata.authorDisplay = {
      ...(isPlainObject(metadata.authorDisplay) ? metadata.authorDisplay : {}),
      ...input.authorDisplay,
    };
  }

  if (isPlainObject(input.access)) {
    metadata.articleAccess = {
      ...(isPlainObject(metadata.articleAccess) ? metadata.articleAccess : {}),
      ...input.access,
    };
  }

  if (isPlainObject(input.preview)) {
    metadata.articlePreview = {
      ...(isPlainObject(metadata.articlePreview) ? metadata.articlePreview : {}),
      ...input.preview,
    };
  }

  const directFields = [
    "accessType",
    "priceAmount",
    "priceLabel",
    "isUnlocked",
    "previewMode",
    "previewValue",
    "contentParagraphCount",
    "previewParagraphCount",
    "previewText",
    "previewRichContent",
    "authorDisplayType",
    "authorDisplayName",
    "authorDisplayAvatarUrl",
    "sourceGroupId",
    "sourceUserId",
  ];

  directFields.forEach((field) => {
    if (input[field] !== undefined) {
      metadata[field] = input[field];
    }
  });

  return normalizeArticleMetadataShape(metadata, {
    postType: "ARTICLE",
    forceArticle: true,
  });
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

async function buildManageableGroupIdSet(groupIds, viewerId) {
  if (!viewerId || !Array.isArray(groupIds) || !groupIds.length) {
    return new Set();
  }

  const uniqueGroupIds = Array.from(new Set(groupIds.map((item) => normalizeString(item)).filter(Boolean)));
  if (!uniqueGroupIds.length) {
    return new Set();
  }

  const [groups, staffs] = await Promise.all([
    prisma.group.findMany({
      where: {
        id: {
          in: uniqueGroupIds,
        },
      },
      select: {
        id: true,
        ownerUserId: true,
      },
    }),
    prisma.groupStaff.findMany({
      where: {
        groupId: {
          in: uniqueGroupIds,
        },
        userId: viewerId,
        isActive: true,
      },
      select: {
        groupId: true,
      },
    }),
  ]);

  const manageableGroupIds = new Set();

  groups.forEach((group) => {
    if (group.ownerUserId === viewerId) {
      manageableGroupIds.add(group.id);
    }
  });

  staffs.forEach((staff) => {
    manageableGroupIds.add(staff.groupId);
  });

  return manageableGroupIds;
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

function toArticleDtoFromSummary(summary) {
  if (!summary || typeof summary !== "object" || !summary.article) {
    return null;
  }

  return {
    id: normalizeString(summary.id),
    groupId: normalizeString(summary.groupId),
    type: "ARTICLE",
    status: normalizeString(summary.status),
    title: summary.article.title,
    summary: summary.article.summary,
    contentText: normalizeString(summary.contentText),
    contentSource: summary.article.contentSource,
    coverUrl: summary.article.coverUrl,
    richContent: summary.article.richContent,
    tags: Array.isArray(summary.article.tags) ? summary.article.tags : [],
    authorDisplay: summary.article.authorDisplay || null,
    access: summary.article.access || null,
    preview: summary.article.preview || null,
    attachments: Array.isArray(summary.attachments) ? summary.attachments : [],
    isPinned: Boolean(summary.isPinned),
    isEssence: Boolean(summary.isEssence),
    readingCount: Number(summary.readingCount || 0),
    likeCount: Number(summary.likeCount || 0),
    commentCount: Number(summary.commentCount || 0),
    publishedAt: normalizeString(summary.publishedAt),
    createdAt: normalizeString(summary.createdAt),
    updatedAt: normalizeString(summary.updatedAt),
    metadata: summary.metadata && typeof summary.metadata === "object" ? summary.metadata : {},
  };
}

function toArticleDtoFromPost(post) {
  if (!post || post.type !== "ARTICLE") {
    return null;
  }

  const metadata = normalizeArticleMetadataShape(post.metadata || {}, {
    postType: post.type,
    forceArticle: true,
  });
  const article = buildArticlePayload(post, {
    metadata,
    group: post.group,
    author: post.author,
  });

  if (!article) {
    return null;
  }

  return {
    id: normalizeString(post.id),
    groupId: normalizeString(post.groupId),
    type: "ARTICLE",
    status: normalizeString(post.status),
    title: article.title,
    summary: article.summary,
    contentText: normalizeString(post.contentText),
    contentSource: article.contentSource,
    coverUrl: article.coverUrl,
    richContent: article.richContent,
    tags: Array.isArray(article.tags) ? article.tags : [],
    authorDisplay: article.authorDisplay,
    access: article.access,
    preview: article.preview,
    attachments: Array.isArray(post.attachments) ? post.attachments : [],
    isPinned: Boolean(post.isPinned),
    isEssence: Boolean(post.isEssence),
    readingCount: Number(post.readingCount || 0),
    likeCount: Number(post.likeCount || 0),
    commentCount: Number(post.commentCount || 0),
    publishedAt: toIso(post.publishedAt),
    createdAt: toIso(post.createdAt),
    updatedAt: toIso(post.updatedAt),
    metadata,
  };
}

async function listArticles(input = {}) {
  const page = parsePositiveInt(input.page, 1, 9999);
  const pageSize = parsePositiveInt(input.pageSize, 20, 50);
  const groupId = normalizeString(input.groupId);
  const search = normalizeString(input.search);
  const contentSource = normalizeContentSource(input.contentSource);
  const accessType = normalizeAccessType(input.accessType);
  const requestedStatus = normalizeStatus(input.status);
  const status = requestedStatus || "PUBLISHED";
  const includeRestricted = normalizeBooleanFlag(input.includeRestricted, false) || status !== "PUBLISHED";
  const viewerId = await resolveViewerIdentity(input.sessionToken, input.userId || "");
  const where = {
    type: "ARTICLE",
  };

  if (status !== "ALL") {
    where.status = status;
  }

  if (groupId) {
    where.groupId = groupId;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
      { contentText: { contains: search, mode: "insensitive" } },
      { author: { profile: { nickname: { contains: search, mode: "insensitive" } } } },
      { group: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.post.findMany({
    where,
    include: {
      author: {
        include: {
          profile: true,
        },
      },
      group: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          coverUrl: true,
        },
      },
    },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
  });
  const manageableGroupIds = await buildManageableGroupIdSet(
    rows.map((post) => post.groupId),
    viewerId
  );
  const viewerUnlockArticleIdSet = await loadViewerArticleUnlockIdSet(
    rows.map((post) => post.id),
    viewerId
  );

  const matchedItems = rows
    .map((post) => {
      const dto = toArticleDtoFromPost(post);
      if (!dto) {
        return null;
      }

      const readAwareDto = applyArticleReadAccessToDto(
        dto,
        {
          groupId: post.groupId,
          authorUserId: post.authorUserId,
          contentText: post.contentText,
          richContent: dto.richContent,
        },
        {
          viewerId,
          isAuthor: Boolean(viewerId && viewerId === post.authorUserId),
          canManage: manageableGroupIds.has(post.groupId),
          isUnlocked: viewerUnlockArticleIdSet.has(post.id),
        }
      );

      return readAwareDto && (!contentSource || readAwareDto.contentSource === contentSource) ? readAwareDto : null;
    })
    .filter(Boolean)
    .filter((article) => !accessType || (article.access && article.access.accessType === accessType))
    .filter((article) => includeRestricted || !isArticleRestrictedForPublic(article.metadata, article.status))
  const total = matchedItems.length;
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const safePage = Math.min(page, totalPages);
  const items = matchedItems.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        page: safePage,
        pageSize,
        total,
        totalPages,
        items,
        filters: {
          groupId,
          search,
          status,
          contentSource,
          accessType,
          includeRestricted,
        },
      },
    },
  };
}

async function getArticleDetail(input = {}) {
  const articleId = normalizeString(input.articleId || input.id || input.postId);
  if (!articleId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少文章ID" } };
  }

  const result = await getPostDetail(articleId, {
    incrementRead: input.incrementRead !== false,
    sessionToken: input.sessionToken,
    userId: input.userId,
  });

  if (result.statusCode !== 200 || !result.payload || !result.payload.ok) {
    return result;
  }

  const summary = result.payload.data;
  const viewerId = await resolveViewerIdentity(input.sessionToken, input.userId || "");
  const managerAccess = viewerId
    ? await getGroupManagerAccess(normalizeString(summary.groupId), viewerId)
    : { canManage: false };
  const viewerUnlockArticleIdSet = await loadViewerArticleUnlockIdSet([articleId], viewerId);
  const article = applyArticleReadAccessToDto(
    toArticleDtoFromSummary(summary),
    {
      groupId: summary.groupId,
      authorUserId: summary.author && summary.author.id,
      contentText: summary.contentText,
      richContent: summary.article && summary.article.richContent,
    },
    {
      viewerId,
      isAuthor: Boolean(viewerId && summary.author && viewerId === summary.author.id),
      canManage: Boolean(managerAccess && managerAccess.canManage),
      isUnlocked: viewerUnlockArticleIdSet.has(articleId),
    },
    {
      includeParagraphs: true,
    }
  );

  if (!article) {
    return { statusCode: 404, payload: { ok: false, message: "文章不存在" } };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: article,
    },
  };
}

async function saveArticle(input = {}) {
  const articleId = normalizeString(input.articleId || input.id || input.postId);
  const metadata = buildArticleWriteMetadata(input);

  const result = articleId
    ? await updatePost({
        postId: articleId,
        title: input.title,
        summary: input.summary,
        contentText: input.contentText,
        attachments: input.attachments,
        metadata,
        isPinned: input.isPinned,
        isEssence: input.isEssence,
        sessionToken: input.sessionToken,
        userId: input.userId,
      })
    : await createPost({
        groupId: input.groupId,
        title: input.title,
        summary: input.summary,
        contentText: input.contentText,
        attachments: input.attachments,
        metadata,
        isPinned: input.isPinned,
        isEssence: input.isEssence,
        type: "ARTICLE",
        sessionToken: input.sessionToken,
        userId: input.userId,
      });

  if (result.statusCode !== 200 && result.statusCode !== 201) {
    return result;
  }

  const summary = result.payload.data;
  const viewerId = await resolveViewerIdentity(input.sessionToken, input.userId || "");
  const managerAccess = viewerId
    ? await getGroupManagerAccess(normalizeString(summary.groupId), viewerId)
    : { canManage: false };
  const articleIdForUnlock = normalizeString(summary.id);
  const viewerUnlockArticleIdSet = await loadViewerArticleUnlockIdSet([articleIdForUnlock], viewerId);
  const article = applyArticleReadAccessToDto(
    toArticleDtoFromSummary(summary),
    {
      groupId: summary.groupId,
      authorUserId: summary.author && summary.author.id,
      contentText: summary.contentText,
      richContent: summary.article && summary.article.richContent,
    },
    {
      viewerId,
      isAuthor: Boolean(viewerId && summary.author && viewerId === summary.author.id),
      canManage: Boolean(managerAccess && managerAccess.canManage),
      isUnlocked: viewerUnlockArticleIdSet.has(articleIdForUnlock),
    },
    {
      includeParagraphs: true,
    }
  );

  if (!article) {
    return { statusCode: 500, payload: { ok: false, message: "文章保存成功，但返回结构异常" } };
  }

  return {
    statusCode: result.statusCode,
    payload: {
      ok: true,
      data: article,
    },
  };
}

async function updateArticleStatus(input = {}) {
  const articleId = normalizeString(input.articleId || input.id || input.postId);
  if (!articleId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少文章ID" } };
  }

  const existingPost = await prisma.post.findUnique({
    where: { id: articleId },
    select: { id: true, type: true },
  });

  if (!existingPost || existingPost.type !== "ARTICLE") {
    return { statusCode: 404, payload: { ok: false, message: "文章不存在" } };
  }

  const result = await updateAdminContent({
    postId: articleId,
    status: input.status,
    isPinned: input.isPinned,
    isEssence: input.isEssence,
    sessionToken: input.sessionToken,
  });

  if (result.statusCode !== 200 || !result.payload || !result.payload.ok) {
    return result;
  }

  const refreshed = await prisma.post.findUnique({
    where: { id: articleId },
    include: {
      author: {
        include: {
          profile: true,
        },
      },
      group: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          coverUrl: true,
        },
      },
    },
  });

  const viewerId = await resolveViewerIdentity(input.sessionToken, "");
  const managerAccess = viewerId
    ? await getGroupManagerAccess(normalizeString(refreshed && refreshed.groupId), viewerId)
    : { canManage: false };
  const viewerUnlockArticleIdSet = await loadViewerArticleUnlockIdSet([articleId], viewerId);
  const article = applyArticleReadAccessToDto(
    toArticleDtoFromPost(refreshed),
    {
      groupId: refreshed && refreshed.groupId,
      authorUserId: refreshed && refreshed.authorUserId,
      contentText: refreshed && refreshed.contentText,
      richContent: refreshed && refreshed.metadata && refreshed.metadata.richContent,
    },
    {
      viewerId,
      isAuthor: Boolean(viewerId && refreshed && viewerId === refreshed.authorUserId),
      canManage: Boolean(managerAccess && managerAccess.canManage),
      isUnlocked: viewerUnlockArticleIdSet.has(articleId),
    },
    {
      includeParagraphs: true,
    }
  );

  if (!article) {
    return { statusCode: 500, payload: { ok: false, message: "文章状态已更新，但返回结构异常" } };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: article,
    },
  };
}

module.exports = {
  listArticles,
  getArticleDetail,
  saveArticle,
  updateArticleStatus,
};
