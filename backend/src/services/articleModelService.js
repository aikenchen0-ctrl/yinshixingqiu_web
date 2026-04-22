function toPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...value };
}

function normalizeString(value) {
  return String(value || "").trim();
}

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function toPositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
}

function normalizeMoneyAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(parsed));
}

function formatPriceLabel(priceAmount) {
  const normalizedPrice = normalizeMoneyAmount(priceAmount);
  return normalizedPrice > 0 ? `¥${normalizedPrice}` : "免费";
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

function normalizeAuthorDisplayType(value) {
  const normalizedValue = normalizeString(value).toLowerCase();
  if (normalizedValue === "group") {
    return "group";
  }

  if (normalizedValue === "wechat_account") {
    return "wechat_account";
  }

  if (normalizedValue === "user") {
    return "user";
  }

  return "";
}

function normalizeTagList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean)
    .slice(0, 8);
}

function buildGroupSnapshot(group) {
  if (!group || typeof group !== "object") {
    return {
      id: "",
      name: "",
      avatarUrl: "",
    };
  }

  return {
    id: normalizeString(group.id),
    name: normalizeString(group.name),
    avatarUrl: normalizeString(group.avatarUrl || group.coverUrl),
  };
}

function buildUserSnapshot(author) {
  if (!author || typeof author !== "object") {
    return {
      id: "",
      name: "",
      avatarUrl: "",
    };
  }

  const profile = author.profile && typeof author.profile === "object" ? author.profile : {};
  return {
    id: normalizeString(author.id),
    name: normalizeString(profile.nickname),
    avatarUrl: normalizeString(profile.avatarUrl),
  };
}

function isArticleContext(postType, metadata) {
  const normalizedPostType = normalizeString(postType).toUpperCase();
  if (normalizedPostType === "ARTICLE") {
    return true;
  }

  return normalizeString(metadata && metadata.publishType).toLowerCase() === "article";
}

function normalizeArticleAccess(metadata) {
  const articleAccess = toPlainObject(metadata.articleAccess);
  const accessSource = Object.keys(articleAccess).length ? articleAccess : metadata;
  const accessType = normalizeString(accessSource.accessType).toLowerCase() === "paid" ? "paid" : "free";
  const priceAmount = accessType === "paid" ? normalizeMoneyAmount(accessSource.priceAmount) : 0;
  const previewMode = normalizeString(accessSource.previewMode).toLowerCase() === "ratio" ? "ratio" : "paragraph";
  const previewValue =
    previewMode === "ratio" ? toPositiveNumber(accessSource.previewValue) : toPositiveInt(accessSource.previewValue);
  const contentParagraphCount = toPositiveInt(accessSource.contentParagraphCount);
  const previewParagraphCount = toPositiveInt(accessSource.previewParagraphCount);
  const priceLabel = accessType === "paid" ? normalizeString(accessSource.priceLabel) || formatPriceLabel(priceAmount) : "免费";

  return {
    accessType,
    priceAmount,
    priceLabel,
    isUnlocked: accessType === "free" ? true : Boolean(accessSource.isUnlocked),
    previewMode,
    previewValue,
    contentParagraphCount,
    previewParagraphCount,
  };
}

function normalizeArticlePreview(metadata) {
  const articlePreview = toPlainObject(metadata.articlePreview);
  const previewText = normalizeString(articlePreview.previewText || metadata.previewText);
  const previewRichContent = normalizeString(articlePreview.previewRichContent || metadata.previewRichContent);

  return {
    previewText,
    previewRichContent,
  };
}

function normalizeAuthorDisplay(metadata) {
  const authorDisplay = toPlainObject(metadata.authorDisplay);
  const type =
    normalizeAuthorDisplayType(authorDisplay.type || metadata.authorDisplayType) ||
    (normalizeString(metadata.contentSource).toLowerCase() === "planet" ? "group" : "");

  return {
    type,
    name: normalizeString(authorDisplay.name || metadata.authorDisplayName),
    avatarUrl: normalizeString(authorDisplay.avatarUrl || metadata.authorDisplayAvatarUrl),
    sourceGroupId: normalizeString(authorDisplay.sourceGroupId || metadata.sourceGroupId),
    sourceUserId: normalizeString(authorDisplay.sourceUserId || metadata.sourceUserId),
  };
}

function extractCoverUrl(post, metadata) {
  const coverUrl = normalizeString(metadata.coverUrl);
  if (coverUrl) {
    return coverUrl;
  }

  const attachments = Array.isArray(post && post.attachments) ? post.attachments : [];
  for (const item of attachments) {
    const normalizedItem = normalizeString(item);
    if (normalizedItem) {
      return normalizedItem;
    }
  }

  return "";
}

function normalizeArticleMetadataShape(metadata, options = {}) {
  const nextMetadata = toPlainObject(metadata);
  if (!isArticleContext(options.postType, nextMetadata) && options.forceArticle !== true) {
    return nextMetadata;
  }

  const contentSource = normalizeContentSource(nextMetadata.contentSource || nextMetadata.sourceType);
  const access = normalizeArticleAccess(nextMetadata);
  const preview = normalizeArticlePreview(nextMetadata);
  const authorDisplay = normalizeAuthorDisplay(nextMetadata);

  nextMetadata.publishType = "article";
  nextMetadata.contentSource = contentSource;
  nextMetadata.tags = normalizeTagList(nextMetadata.tags);
  nextMetadata.coverUrl = normalizeString(nextMetadata.coverUrl || nextMetadata.coverImageUrl);
  nextMetadata.richContent = normalizeString(nextMetadata.richContent);
  nextMetadata.authorDisplay = authorDisplay;
  nextMetadata.authorDisplayType = authorDisplay.type;
  nextMetadata.authorDisplayName = authorDisplay.name;
  nextMetadata.authorDisplayAvatarUrl = authorDisplay.avatarUrl;
  nextMetadata.sourceGroupId = authorDisplay.sourceGroupId;
  nextMetadata.sourceUserId = authorDisplay.sourceUserId;
  nextMetadata.articleAccess = access;
  nextMetadata.accessType = access.accessType;
  nextMetadata.priceAmount = access.priceAmount;
  nextMetadata.priceLabel = access.priceLabel;
  nextMetadata.isUnlocked = access.isUnlocked;
  nextMetadata.previewMode = access.previewMode;
  nextMetadata.previewValue = access.previewValue;
  nextMetadata.contentParagraphCount = access.contentParagraphCount;
  nextMetadata.previewParagraphCount = access.previewParagraphCount;
  nextMetadata.articlePreview = preview;
  nextMetadata.previewText = preview.previewText;
  nextMetadata.previewRichContent = preview.previewRichContent;

  return nextMetadata;
}

function finalizeArticleMetadataForWrite(metadata, options = {}) {
  const nextMetadata = normalizeArticleMetadataShape(metadata, {
    postType: options.postType,
    forceArticle: options.forceArticle,
  });

  if (!isArticleContext(options.postType, nextMetadata) && options.forceArticle !== true) {
    return nextMetadata;
  }

  const groupSnapshot = buildGroupSnapshot(options.group);
  const userSnapshot = buildUserSnapshot(options.author);
  const contentSource = normalizeContentSource(nextMetadata.contentSource) || "planet";
  const currentAuthorDisplay = normalizeAuthorDisplay(nextMetadata);
  let authorDisplay = currentAuthorDisplay;

  if (contentSource === "planet") {
    authorDisplay = {
      type: "group",
      name: groupSnapshot.name || currentAuthorDisplay.name || "知识星球",
      avatarUrl: groupSnapshot.avatarUrl || currentAuthorDisplay.avatarUrl || "",
      sourceGroupId: groupSnapshot.id || currentAuthorDisplay.sourceGroupId || "",
      sourceUserId: userSnapshot.id || currentAuthorDisplay.sourceUserId || "",
    };
  } else if (contentSource === "wechat") {
    authorDisplay = {
      type: "wechat_account",
      name: currentAuthorDisplay.name || groupSnapshot.name || userSnapshot.name || "微信公众号",
      avatarUrl: currentAuthorDisplay.avatarUrl || groupSnapshot.avatarUrl || userSnapshot.avatarUrl || "",
      sourceGroupId: groupSnapshot.id || currentAuthorDisplay.sourceGroupId || "",
      sourceUserId: userSnapshot.id || currentAuthorDisplay.sourceUserId || "",
    };
  } else {
    authorDisplay = {
      type: currentAuthorDisplay.type || "user",
      name: currentAuthorDisplay.name || userSnapshot.name || "当前成员",
      avatarUrl: currentAuthorDisplay.avatarUrl || userSnapshot.avatarUrl || "",
      sourceGroupId: groupSnapshot.id || currentAuthorDisplay.sourceGroupId || "",
      sourceUserId: userSnapshot.id || currentAuthorDisplay.sourceUserId || "",
    };
  }

  nextMetadata.contentSource = contentSource;
  nextMetadata.authorDisplay = authorDisplay;
  nextMetadata.authorDisplayType = authorDisplay.type;
  nextMetadata.authorDisplayName = authorDisplay.name;
  nextMetadata.authorDisplayAvatarUrl = authorDisplay.avatarUrl;
  nextMetadata.sourceGroupId = authorDisplay.sourceGroupId;
  nextMetadata.sourceUserId = authorDisplay.sourceUserId;

  return normalizeArticleMetadataShape(nextMetadata, {
    postType: options.postType,
    forceArticle: true,
  });
}

function buildArticlePayload(post, options = {}) {
  const metadata = normalizeArticleMetadataShape(options.metadata || (post && post.metadata) || {}, {
    postType: post && post.type,
    forceArticle: post && post.type === "ARTICLE",
  });

  if (!isArticleContext(post && post.type, metadata)) {
    return null;
  }

  const groupSnapshot = buildGroupSnapshot(options.group || (post && post.group));
  const userSnapshot = buildUserSnapshot(options.author || (post && post.author));
  const contentSource = normalizeContentSource(metadata.contentSource) || "planet";
  let authorDisplay = normalizeAuthorDisplay(metadata);

  if (contentSource === "planet") {
    authorDisplay = {
      type: "group",
      name: groupSnapshot.name || authorDisplay.name || "知识星球",
      avatarUrl: groupSnapshot.avatarUrl || authorDisplay.avatarUrl || "",
      sourceGroupId: groupSnapshot.id || authorDisplay.sourceGroupId || "",
      sourceUserId: userSnapshot.id || authorDisplay.sourceUserId || "",
    };
  } else if (contentSource === "wechat") {
    authorDisplay = {
      type: authorDisplay.type || "wechat_account",
      name: authorDisplay.name || groupSnapshot.name || userSnapshot.name || "微信公众号",
      avatarUrl: authorDisplay.avatarUrl || groupSnapshot.avatarUrl || userSnapshot.avatarUrl || "",
      sourceGroupId: groupSnapshot.id || authorDisplay.sourceGroupId || "",
      sourceUserId: userSnapshot.id || authorDisplay.sourceUserId || "",
    };
  } else {
    authorDisplay = {
      type: authorDisplay.type || "user",
      name: authorDisplay.name || userSnapshot.name || "当前成员",
      avatarUrl: authorDisplay.avatarUrl || userSnapshot.avatarUrl || "",
      sourceGroupId: groupSnapshot.id || authorDisplay.sourceGroupId || "",
      sourceUserId: userSnapshot.id || authorDisplay.sourceUserId || "",
    };
  }

  const title =
    normalizeString(post && post.title) ||
    normalizeString(post && post.summary) ||
    normalizeString(post && post.contentText).slice(0, 48) ||
    "无标题文章";
  const summary = normalizeString(post && post.summary) || normalizeString(post && post.contentText).slice(0, 120);
  const access = normalizeArticleAccess(metadata);
  const preview = normalizeArticlePreview(metadata);

  return {
    id: normalizeString(post && post.id),
    title,
    summary,
    contentSource,
    coverUrl: extractCoverUrl(post, metadata),
    richContent: normalizeString(metadata.richContent),
    tags: normalizeTagList(metadata.tags),
    authorDisplay,
    access,
    preview: {
      previewText: preview.previewText,
      previewRichContent: preview.previewRichContent,
      contentParagraphCount: access.contentParagraphCount,
      previewParagraphCount: access.previewParagraphCount,
      previewMode: access.previewMode,
      previewValue: access.previewValue,
    },
  };
}

module.exports = {
  buildArticlePayload,
  finalizeArticleMetadataForWrite,
  normalizeArticleMetadataShape,
};
