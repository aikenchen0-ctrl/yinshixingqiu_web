const fs = require("fs");
const path = require("path");
const { prisma } = require("../db/prisma");
const {
  getMembershipStatus: getJoinMembershipStatus,
  findPreferredRenewalCoupon,
} = require("./joinFlowService");
const {
  buildArticlePayload,
  finalizeArticleMetadataForWrite,
  normalizeArticleMetadataShape,
} = require("./articleModelService");
const { applyArticleReadAccessToDto, loadViewerArticleUnlockIdSet } = require("./articleReadService");
const { getPaywallHighlightSnapshot } = require("./paywallHighlightStore");
const { getRenewalSettingColumnNames } = require("./renewalSettingSchemaService");
const { generateUnlimitedMiniProgramCode, getMiniProgramCodeEnvVersion } = require("./wechatService");

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const RENEWAL_ENTRY_DAYS = 30;
const UPLOAD_ROOT_PATH = path.join(__dirname, "..", "..", "uploads");
const PLANET_SHARE_MINI_CODE_DIR = path.join(UPLOAD_ROOT_PATH, "mini-program-codes", "planet-share");
const PLANET_SHARE_MINI_CODE_PAGE = "pages/planet/home";
const RENEWAL_HOME_SETTING_COLUMN_DEFINITIONS = [
  { key: "enabled", column: "enabled" },
  { key: "limitWindow", column: "limit_window" },
  { key: "amount", column: "amount" },
  { key: "originalAmount", column: "original_amount" },
  { key: "discountedPercentage", column: "discounted_percentage" },
  { key: "expiringEnabled", column: "expiring_enabled" },
  { key: "advanceAmount", column: "advance_amount" },
  { key: "advanceDiscountPercentage", column: "advance_discount_percentage" },
  { key: "advanceEnabled", column: "advance_enabled" },
  { key: "graceAmount", column: "grace_amount" },
  { key: "graceDiscountPercentage", column: "grace_discount_percentage" },
  { key: "graceEnabled", column: "grace_enabled" },
  { key: "beginTime", column: "begin_time" },
  { key: "endTime", column: "end_time" },
  { key: "guidance", column: "guidance" },
  { key: "renewalUrl", column: "renewal_url" },
];

function toOptionalDateString(value) {
  return value ? new Date(value).toISOString() : null;
}

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function toMoneyNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function buildDiscountPercent(amount, originalAmount) {
  const normalizedOriginalAmount = toMoneyNumber(originalAmount);
  if (normalizedOriginalAmount <= 0) {
    return 100;
  }

  return Math.round((toMoneyNumber(amount) / normalizedOriginalAmount) * 100);
}

function sanitizeMiniCodeFileSegment(value) {
  const normalizedValue = String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "_");
  return normalizedValue || "planet";
}

function resolvePlanetShareMiniCodeScene(groupId) {
  const scene = `g=${String(groupId || "").trim()}`;

  if (scene.length > 32) {
    throw new Error("星球ID过长，暂时无法生成分享小程序码");
  }

  return scene;
}

function resolveMiniCodeFileExtension(contentType) {
  const normalizedContentType = String(contentType || "").trim().toLowerCase();

  if (normalizedContentType.includes("jpeg") || normalizedContentType.includes("jpg")) {
    return ".jpg";
  }

  if (normalizedContentType.includes("webp")) {
    return ".webp";
  }

  return ".png";
}

function findExistingPlanetShareMiniCodeFile(groupId, envVersion) {
  const safeGroupId = sanitizeMiniCodeFileSegment(groupId);
  const targetDir = path.join(PLANET_SHARE_MINI_CODE_DIR, envVersion);
  const candidateExtensions = [".png", ".jpg", ".jpeg", ".webp"];

  for (let index = 0; index < candidateExtensions.length; index += 1) {
    const extension = candidateExtensions[index];
    const filePath = path.join(targetDir, `${safeGroupId}${extension}`);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile() && fs.statSync(filePath).size > 0) {
      return `/uploads/mini-program-codes/planet-share/${envVersion}/${safeGroupId}${extension}`;
    }
  }

  return "";
}

async function ensurePlanetShareMiniCode(groupId) {
  const envVersion = getMiniProgramCodeEnvVersion();
  const existingFileUrl = findExistingPlanetShareMiniCodeFile(groupId, envVersion);
  if (existingFileUrl) {
    return existingFileUrl;
  }

  const scene = resolvePlanetShareMiniCodeScene(groupId);
  const generatedCode = await generateUnlimitedMiniProgramCode({
    page: PLANET_SHARE_MINI_CODE_PAGE,
    scene,
    envVersion,
    width: 430,
  });

  const fileExtension = resolveMiniCodeFileExtension(generatedCode.contentType);
  const safeGroupId = sanitizeMiniCodeFileSegment(groupId);
  const targetDir = path.join(PLANET_SHARE_MINI_CODE_DIR, envVersion);
  fs.mkdirSync(targetDir, { recursive: true });

  const savedPath = path.join(targetDir, `${safeGroupId}${fileExtension}`);
  fs.writeFileSync(savedPath, generatedCode.buffer);

  return `/uploads/mini-program-codes/planet-share/${envVersion}/${safeGroupId}${fileExtension}`;
}

function getDateValue(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

async function findGroupRenewalSetting(groupId) {
  if (!groupId) {
    return null;
  }

  const columnNames = await getRenewalSettingColumnNames();
  if (!columnNames.size || !columnNames.has("group_id")) {
    return null;
  }

  const selectedColumns = RENEWAL_HOME_SETTING_COLUMN_DEFINITIONS.filter((item) => columnNames.has(item.column));
  if (!selectedColumns.length) {
    return null;
  }

  const selectClause = selectedColumns.map((item) => `"${item.column}"`).join(", ");

  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT ${selectClause} FROM "renewal_settings" WHERE "group_id" = $1 LIMIT 1`,
      groupId
    );
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row) {
      return null;
    }

    return selectedColumns.reduce((result, item) => {
      result[item.key] = row[item.column];
      return result;
    }, {});
  } catch (error) {
    return null;
  }
}

function resolveRenewalStage(daysUntilExpire, isExpired) {
  if (isExpired) {
    return "grace";
  }

  if (typeof daysUntilExpire !== "number" || daysUntilExpire > RENEWAL_ENTRY_DAYS) {
    return "";
  }

  return daysUntilExpire > 7 ? "advance" : "expiring";
}

function isRenewalWindowOpen(setting, now) {
  if (!setting || setting.limitWindow !== true) {
    return true;
  }

  const beginTime = getDateValue(setting.beginTime);
  const endTime = getDateValue(setting.endTime);

  if (beginTime && now.getTime() < beginTime.getTime()) {
    return false;
  }

  if (endTime && now.getTime() > endTime.getTime()) {
    return false;
  }

  return true;
}

function buildGroupRenewalSnapshot(input = {}) {
  const {
    group,
    membership,
    membershipSnapshot,
    isOwner = false,
    setting = null,
    now = new Date(),
  } = input;

  const expireAtDate = getDateValue(
    membershipSnapshot && membershipSnapshot.expireAt ? membershipSnapshot.expireAt : membership && membership.expireAt
  );
  const expireAtTime = expireAtDate ? expireAtDate.getTime() : 0;
  const diffMs = expireAtDate ? expireAtTime - now.getTime() : null;
  const isExpired = typeof diffMs === "number" ? diffMs <= 0 : false;
  const daysUntilExpire =
    typeof diffMs === "number"
      ? diffMs > 0
        ? Math.ceil(diffMs / DAY_IN_MS)
        : Math.floor(diffMs / DAY_IN_MS)
      : null;
  const isExpiringSoon = typeof diffMs === "number" ? diffMs > 0 && diffMs <= RENEWAL_ENTRY_DAYS * DAY_IN_MS : false;
  const stage = resolveRenewalStage(daysUntilExpire, isExpired);
  const isPaidGroup = String(group && group.joinType ? group.joinType : "").toUpperCase() !== "FREE";
  const membershipStatus = String(
    (membershipSnapshot && membershipSnapshot.status) || (membership && membership.status) || ""
  ).toUpperCase();
  const canRenewByStatus = membershipStatus === "ACTIVE" || membershipStatus === "EXPIRED";
  const overallEnabled = setting ? setting.enabled !== false : true;
  const windowOpen = isRenewalWindowOpen(setting, now);
  const stageEnabled =
    stage === "grace"
      ? setting
        ? setting.graceEnabled !== false
        : true
      : stage === "advance"
        ? setting
          ? setting.advanceEnabled !== false
          : true
        : stage === "expiring"
          ? setting
            ? setting.expiringEnabled !== false
            : true
          : false;

  const groupPriceAmount = toMoneyNumber(group && group.priceAmount);
  const groupOriginalAmount = toMoneyNumber(group && group.originalPriceAmount) || groupPriceAmount;
  const defaultAmount = setting ? toMoneyNumber(setting.amount) || groupPriceAmount : groupPriceAmount;
  const originalAmount = setting ? toMoneyNumber(setting.originalAmount) || groupOriginalAmount : groupOriginalAmount;
  const amount =
    stage === "grace"
      ? setting
        ? toMoneyNumber(setting.graceAmount) || defaultAmount
        : defaultAmount
      : stage === "advance"
        ? setting
          ? toMoneyNumber(setting.advanceAmount) || defaultAmount
          : defaultAmount
        : defaultAmount;
  const discountedPercentage =
    stage === "grace"
      ? setting && Number.isFinite(Number(setting.graceDiscountPercentage))
        ? Number(setting.graceDiscountPercentage)
        : buildDiscountPercent(amount, originalAmount)
      : stage === "advance"
        ? setting && Number.isFinite(Number(setting.advanceDiscountPercentage))
          ? Number(setting.advanceDiscountPercentage)
          : buildDiscountPercent(amount, originalAmount)
        : setting && Number.isFinite(Number(setting.discountedPercentage))
          ? Number(setting.discountedPercentage)
          : buildDiscountPercent(amount, originalAmount);
  const canRenew = Boolean(
    overallEnabled &&
      windowOpen &&
      !isOwner &&
      isPaidGroup &&
      membership &&
      membership.isPaid &&
      expireAtDate &&
      canRenewByStatus &&
      (isExpired || isExpiringSoon) &&
      stageEnabled
  );

  return {
    enabled: overallEnabled && windowOpen,
    canRenew,
    stage,
    isExpired,
    isExpiringSoon,
    daysUntilExpire,
    expireAt: expireAtDate ? expireAtDate.toISOString() : null,
    amount,
    originalAmount,
    discountedPercentage,
    guidance: setting && typeof setting.guidance === "string" ? setting.guidance : "",
    renewalUrl: setting && typeof setting.renewalUrl === "string" ? setting.renewalUrl.trim() : "",
  };
}

function applyPreferredRenewalCoupon(renewal, coupon) {
  if (!renewal) {
    return null;
  }

  const renewalAmount = Math.max(toMoneyNumber(renewal.amount), 0);
  const couponDiscountAmount = coupon ? Math.min(Math.max(toMoneyNumber(coupon.amount), 0), renewalAmount) : 0;
  const payableAmount = Math.max(renewalAmount - couponDiscountAmount, 0);

  return {
    ...renewal,
    payableAmount,
    coupon:
      coupon && couponDiscountAmount > 0
        ? {
            id: coupon.id,
            code: coupon.code,
            name: coupon.name,
            discountAmount: couponDiscountAmount,
          }
        : null,
  };
}

function normalizePostReportStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (status === "PENDING" || status === "RESOLVED" || status === "IGNORED") {
    return status;
  }

  return "";
}

function normalizePostReportLog(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const status = normalizePostReportStatus(value.status);
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  if (!createdAt) {
    return null;
  }

  return {
    id: typeof value.id === "string" ? value.id : "",
    reporterUserId: typeof value.reporterUserId === "string" ? value.reporterUserId : "",
    reporterName: typeof value.reporterName === "string" ? value.reporterName : "",
    reason: typeof value.reason === "string" ? value.reason.trim() : "",
    status: status || "PENDING",
    createdAt,
    resolvedAt: typeof value.resolvedAt === "string" ? value.resolvedAt : "",
    resolutionNote: typeof value.resolutionNote === "string" ? value.resolutionNote.trim() : "",
  };
}

function buildPostReportMetadata(metadata) {
  const reportLogs = Array.isArray(metadata.reportLogs)
    ? metadata.reportLogs.map(normalizePostReportLog).filter(Boolean).slice(-20)
    : [];
  const latestLog = reportLogs.length ? reportLogs[reportLogs.length - 1] : null;
  const summary = {
    reportLogs,
    reportStatus: normalizePostReportStatus(metadata.reportStatus),
    reportCount: reportLogs.length,
    reportPendingCount: reportLogs.filter((item) => item.status === "PENDING").length,
    reportResolvedCount: reportLogs.filter((item) => item.status === "RESOLVED").length,
    reportIgnoredCount: reportLogs.filter((item) => item.status === "IGNORED").length,
    lastReportedAt: latestLog ? latestLog.createdAt : "",
    lastReportedReason: latestLog ? latestLog.reason : "",
    reportResolutionNote:
      typeof metadata.reportResolutionNote === "string"
        ? metadata.reportResolutionNote.trim()
        : latestLog && latestLog.status !== "PENDING"
          ? latestLog.resolutionNote
          : "",
  };

  if (summary.reportStatus === "PENDING" && !summary.reportPendingCount && summary.reportCount) {
    summary.reportStatus = latestLog ? latestLog.status : "";
  }

  if (!summary.reportStatus) {
    if (summary.reportPendingCount) {
      summary.reportStatus = "PENDING";
    } else if (latestLog) {
      summary.reportStatus = latestLog.status;
    }
  }

  if (!summary.reportCount) {
    const fallbackStatus = normalizePostReportStatus(metadata.reportStatus);
    const fallbackCount = toPositiveInt(metadata.reportCount);
    summary.reportStatus = fallbackStatus;
    summary.reportCount = fallbackCount;
    summary.reportPendingCount = fallbackStatus === "PENDING" ? Math.max(toPositiveInt(metadata.reportPendingCount), fallbackCount || 1) : 0;
    summary.reportResolvedCount = fallbackStatus === "RESOLVED" ? Math.max(toPositiveInt(metadata.reportResolvedCount), fallbackCount || 1) : 0;
    summary.reportIgnoredCount = fallbackStatus === "IGNORED" ? Math.max(toPositiveInt(metadata.reportIgnoredCount), fallbackCount || 1) : 0;
    summary.lastReportedAt = typeof metadata.lastReportedAt === "string" ? metadata.lastReportedAt : "";
    summary.lastReportedReason = typeof metadata.lastReportedReason === "string" ? metadata.lastReportedReason.trim() : "";
    summary.reportResolutionNote = typeof metadata.reportResolutionNote === "string" ? metadata.reportResolutionNote.trim() : "";
  }

  return summary;
}

function applyPostReportMetadata(metadata, reportSummary) {
  metadata.reportLogs = reportSummary.reportLogs;
  metadata.reportStatus = reportSummary.reportStatus;
  metadata.reportCount = reportSummary.reportCount;
  metadata.reportPendingCount = reportSummary.reportPendingCount;
  metadata.reportResolvedCount = reportSummary.reportResolvedCount;
  metadata.reportIgnoredCount = reportSummary.reportIgnoredCount;
  metadata.lastReportedAt = reportSummary.lastReportedAt;
  metadata.lastReportedReason = reportSummary.lastReportedReason;
  metadata.reportResolutionNote = reportSummary.reportResolutionNote;
  return metadata;
}

function sanitizePublicPostMetadata(value) {
  const metadata = normalizeMetadata(value);
  delete metadata.reportLogs;
  delete metadata.reportStatus;
  delete metadata.reportCount;
  delete metadata.reportPendingCount;
  delete metadata.reportResolvedCount;
  delete metadata.reportIgnoredCount;
  delete metadata.lastReportedAt;
  delete metadata.lastReportedReason;
  delete metadata.reportResolutionNote;
  return metadata;
}

function createPostReportLogId() {
  return `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toPostSummary(post) {
  const authorProfile = post.author && post.author.profile ? post.author.profile : null;
  const viewerLiked = Array.isArray(post.likes) && post.likes.length > 0;
  const metadata = sanitizePublicPostMetadata(post.metadata || {});
  const article = buildArticlePayload(post, {
    metadata,
    group: post.group,
    author: post.author,
  });
  return {
    id: post.id,
    groupId: post.groupId,
    type: post.type,
    status: post.status,
    title: post.title || "",
    summary: post.summary || "",
    contentText: post.contentText || "",
    author: {
      id: post.author ? post.author.id : "",
      nickname: authorProfile ? authorProfile.nickname : "当前成员",
      avatarUrl: authorProfile ? authorProfile.avatarUrl || "" : "",
    },
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    readingCount: post.readingCount,
    viewerLiked,
    isPinned: post.isPinned,
    isEssence: post.isEssence,
    publishedAt: toOptionalDateString(post.publishedAt),
    createdAt: toOptionalDateString(post.createdAt),
    updatedAt: toOptionalDateString(post.updatedAt),
    attachments: Array.isArray(post.attachments) ? post.attachments : [],
    coverUrl: extractPostCover(post),
    metadata,
    contentSource: article ? article.contentSource : "",
    authorDisplay: article ? article.authorDisplay : null,
    article,
  };
}

function buildArticleDtoFromPostSummary(summary) {
  if (!summary || summary.type !== "ARTICLE" || !summary.article) {
    return null;
  }

  return {
    id: summary.id,
    groupId: summary.groupId,
    type: summary.type,
    status: summary.status,
    title: summary.title,
    summary: summary.summary,
    contentText: summary.contentText,
    contentSource: summary.article.contentSource,
    coverUrl: summary.coverUrl,
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
    publishedAt: summary.publishedAt,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    metadata: summary.metadata && typeof summary.metadata === "object" ? summary.metadata : {},
  };
}

function applyReadAccessToPostSummary(summary, post, viewerContext = {}, options = {}) {
  const articleDto = buildArticleDtoFromPostSummary(summary);
  if (!articleDto) {
    return summary;
  }

  const readAwareArticle = applyArticleReadAccessToDto(
    articleDto,
    {
      groupId: post.groupId,
      authorUserId: post.authorUserId,
      contentText: post.contentText,
      richContent: summary.article && summary.article.richContent,
    },
    viewerContext,
    options
  );

  if (!readAwareArticle) {
    return summary;
  }

  return {
    ...summary,
    contentText: readAwareArticle.contentText,
    metadata: readAwareArticle.metadata,
    article: {
      ...summary.article,
      contentSource: readAwareArticle.contentSource,
      coverUrl: readAwareArticle.coverUrl,
      richContent: readAwareArticle.richContent,
      tags: Array.isArray(readAwareArticle.tags) ? readAwareArticle.tags : [],
      authorDisplay: readAwareArticle.authorDisplay,
      access: readAwareArticle.access,
      preview: readAwareArticle.preview,
    },
    readState: readAwareArticle.readState,
    canReadFull: readAwareArticle.canReadFull,
    fullParagraphCount: readAwareArticle.fullParagraphCount,
    visibleParagraphCount: readAwareArticle.visibleParagraphCount,
    hiddenParagraphCount: readAwareArticle.hiddenParagraphCount,
    previewContentText: readAwareArticle.previewContentText,
    previewRichContent: readAwareArticle.previewRichContent,
    contentParagraphs: readAwareArticle.contentParagraphs,
    previewParagraphs: readAwareArticle.previewParagraphs,
  };
}

function toCommentItem(comment) {
  const userProfile = comment.user && comment.user.profile ? comment.user.profile : null;
  const viewerLiked = Array.isArray(comment.likes) && comment.likes.length > 0;
  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId || null,
    content: comment.contentText || "",
    likeCount: comment.likeCount,
    viewerLiked,
    attachments: Array.isArray(comment.attachments) ? comment.attachments : [],
    createdAt: toOptionalDateString(comment.createdAt),
    updatedAt: toOptionalDateString(comment.updatedAt),
    author: {
      id: comment.user ? comment.user.id : "",
      nickname: userProfile ? userProfile.nickname : "当前成员",
      avatarUrl: userProfile ? userProfile.avatarUrl || "" : "",
    },
  };
}

function parseCursor(value) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeAttachmentList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (item && typeof item === "object" && typeof item.url === "string") {
        return item.url.trim();
      }

      return "";
    })
    .filter(Boolean)
    .slice(0, 9);
}

function isAssetUrlValue(value) {
  return /^https?:\/\//.test(value) || /^\//.test(value);
}

function isVideoAssetUrl(value) {
  return /\.(mp4|m4v|mov|webm|ogv|ogg)(\?.*)?$/i.test(String(value || "").trim());
}

function getAttachmentFallbackName(url, fallbackName) {
  const normalizedUrl = String(url || "").trim().split(/[?#]/)[0];
  const filename = normalizedUrl.split("/").pop() || "";
  return filename || fallbackName;
}

function normalizeVideoAttachmentList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        const url = item.trim();
        if (!url) {
          return null;
        }

        return {
          name: getAttachmentFallbackName(url, "视频附件"),
          url,
          poster: "",
          sizeText: "",
          mimeType: "",
        };
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const nextItem = {
        name: typeof item.name === "string" ? item.name.trim() : "",
        url: typeof item.url === "string" ? item.url.trim() : "",
        poster: typeof item.poster === "string" ? item.poster.trim() : "",
        sizeText: typeof item.sizeText === "string" ? item.sizeText.trim() : "",
        mimeType: typeof item.mimeType === "string" ? item.mimeType.trim() : "",
      };

      if (!nextItem.url) {
        return null;
      }

      if (!nextItem.name) {
        nextItem.name = getAttachmentFallbackName(nextItem.url, "视频附件");
      }

      return nextItem;
    })
    .filter(Boolean)
    .slice(0, 5);
}

function hasEmbeddedPostMedia(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  return Boolean(
    (Array.isArray(metadata.images) && metadata.images.length) ||
      (Array.isArray(metadata.videos) && metadata.videos.length) ||
      (Array.isArray(metadata.videoAttachments) && metadata.videoAttachments.length) ||
      (Array.isArray(metadata.fileAttachments) && metadata.fileAttachments.length)
  );
}

function normalizeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const nextMetadata = { ...value };
  nextMetadata.tags = Array.isArray(nextMetadata.tags)
    ? nextMetadata.tags.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8)
    : [];
  const rawCoverUrl =
    typeof nextMetadata.coverUrl === "string"
      ? nextMetadata.coverUrl
      : typeof nextMetadata.coverImageUrl === "string"
        ? nextMetadata.coverImageUrl
        : "";
  nextMetadata.coverUrl = rawCoverUrl.trim();
  delete nextMetadata.coverImageUrl;
  nextMetadata.richContent = typeof nextMetadata.richContent === "string" ? nextMetadata.richContent : "";
  nextMetadata.images = normalizeAttachmentList(nextMetadata.images);
  nextMetadata.publishType = typeof nextMetadata.publishType === "string" ? nextMetadata.publishType : "";
  nextMetadata.questionTargetId = typeof nextMetadata.questionTargetId === "string" ? nextMetadata.questionTargetId : "";
  nextMetadata.questionTargetName = typeof nextMetadata.questionTargetName === "string" ? nextMetadata.questionTargetName : "";
  nextMetadata.answerStatus = typeof nextMetadata.answerStatus === "string" ? nextMetadata.answerStatus : "";
  nextMetadata.reviewStatus = typeof nextMetadata.reviewStatus === "string" ? nextMetadata.reviewStatus : "";
  nextMetadata.reviewReason = typeof nextMetadata.reviewReason === "string" ? nextMetadata.reviewReason : "";
  const normalizedVideoAttachments = normalizeVideoAttachmentList(nextMetadata.videoAttachments);
  const normalizedVideoUrls = normalizeAttachmentList(nextMetadata.videos);
  nextMetadata.videoAttachments = normalizedVideoAttachments;
  nextMetadata.videos = Array.from(
    new Set(normalizedVideoUrls.concat(normalizedVideoAttachments.map((item) => item.url)))
  ).slice(0, 5);
  nextMetadata.hasVideo = nextMetadata.hasVideo === true || nextMetadata.videoAttachments.length > 0 || nextMetadata.videos.length > 0;
  nextMetadata.fileName = typeof nextMetadata.fileName === "string" ? nextMetadata.fileName : "";
  nextMetadata.fileAttachments = Array.isArray(nextMetadata.fileAttachments)
    ? nextMetadata.fileAttachments
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const nextItem = {
            name: typeof item.name === "string" ? item.name.trim() : "",
            url: typeof item.url === "string" ? item.url.trim() : "",
            sizeText: typeof item.sizeText === "string" ? item.sizeText.trim() : "",
            mimeType: typeof item.mimeType === "string" ? item.mimeType.trim() : "",
          };

          if (!nextItem.url) {
            return null;
          }

          if (!nextItem.name) {
            nextItem.name = "未命名文件";
          }

          return nextItem;
        })
        .filter(Boolean)
        .slice(0, 5)
    : [];
  nextMetadata.hasFile = nextMetadata.hasFile === true || nextMetadata.fileAttachments.length > 0;
  const normalizedMetadata = normalizeArticleMetadataShape(nextMetadata);
  const reportSummary = buildPostReportMetadata(normalizedMetadata);
  applyPostReportMetadata(normalizedMetadata, reportSummary);
  return normalizedMetadata;
}

async function getCurrentViewer(sessionToken, userId) {
  if (sessionToken) {
    const session = await prisma.authSession.findUnique({
      where: { sessionToken },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (session && session.status === "ACTIVE" && session.expiresAt.getTime() > Date.now()) {
      return {
        id: session.userId,
        profile: session.user.profile || null,
      };
    }
  }

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (user) {
      return {
        id: user.id,
        profile: user.profile || null,
      };
    }
  }

  return null;
}

async function resolveViewerIdentity(sessionToken, userId) {
  const viewer = await getCurrentViewer(sessionToken, userId);
  return viewer ? viewer.id : "";
}

function buildViewerLikeInclude(viewerId) {
  if (!viewerId) {
    return false;
  }

  return {
    where: {
      userId: viewerId,
    },
    select: {
      id: true,
    },
    take: 1,
  };
}

function membershipIsActive(membership) {
  if (!membership) {
    return false;
  }

  if (membership.status !== "ACTIVE") {
    return false;
  }

  if (!membership.expireAt) {
    return true;
  }

  return new Date(membership.expireAt).getTime() > Date.now();
}

function normalizeReviewStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function mapPostStatusLabel(status) {
  const labelMap = {
    DRAFT: "草稿",
    PUBLISHED: "已发布",
    HIDDEN: "已隐藏",
    DELETED: "已删除",
  };
  return labelMap[status] || status || "未知状态";
}

function mapReviewStatusLabel(status) {
  const labelMap = {
    APPROVED: "已通过",
    PENDING: "审核中",
    REJECTED: "已驳回",
  };
  return labelMap[status] || "未审核";
}

function mapReportStatusLabel(status) {
  const labelMap = {
    PENDING: "待处理举报",
    RESOLVED: "已处理举报",
    IGNORED: "已忽略举报",
  };
  return labelMap[status] || "无举报";
}

function isReviewRestrictedForPublic(metadata) {
  const reviewStatus = normalizeReviewStatus(metadata && metadata.reviewStatus);
  return reviewStatus === "PENDING" || reviewStatus === "REJECTED";
}

async function getGroupManagerAccess(groupId, viewerId) {
  if (!groupId || !viewerId) {
    return {
      isOwner: false,
      isStaff: false,
      canManage: false,
    };
  }

  const [group, staff] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      select: { ownerUserId: true },
    }),
    prisma.groupStaff.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: viewerId,
        },
      },
      select: {
        id: true,
        isActive: true,
      },
    }),
  ]);

  const isOwner = Boolean(group && group.ownerUserId === viewerId);
  const isStaff = Boolean(staff && staff.isActive);
  return {
    isOwner,
    isStaff,
    canManage: isOwner || isStaff,
  };
}

async function canViewerAccessRestrictedPost(post, viewerId) {
  if (!post || !viewerId) {
    return false;
  }

  if (post.authorUserId === viewerId) {
    return true;
  }

  const access = await getGroupManagerAccess(post.groupId, viewerId);
  return access.canManage;
}

function isPostRestrictedForPublic(post) {
  if (!post) {
    return true;
  }

  return post.status !== "PUBLISHED" || isReviewRestrictedForPublic(normalizeMetadata(post.metadata || {}));
}

function filterPostsForViewerVisibility(posts, canManage) {
  if (!Array.isArray(posts) || !posts.length) {
    return [];
  }

  if (canManage) {
    return posts;
  }

  return posts.filter((post) => !isPostRestrictedForPublic(post));
}

async function canViewerReadPost(post, viewerId) {
  if (!post) {
    return false;
  }

  if (!isPostRestrictedForPublic(post)) {
    return true;
  }

  return canViewerAccessRestrictedPost(post, viewerId);
}

async function buildViewerPostModeration(post, viewerId) {
  if (!post || !viewerId) {
    return null;
  }

  const isAuthor = post.authorUserId === viewerId;
  const managerAccess = isAuthor
    ? {
        isOwner: false,
        isStaff: false,
        canManage: false,
      }
    : await getGroupManagerAccess(post.groupId, viewerId);
  if (!isAuthor && !managerAccess.canManage) {
    return null;
  }

  const status = String(post.status || "").trim().toUpperCase();
  const metadata = normalizeMetadata(post.metadata || {});
  const reviewStatus = normalizeReviewStatus(metadata.reviewStatus);
  const reportSummary = buildPostReportMetadata(metadata);
  const hasModerationState =
    status !== "PUBLISHED" ||
    reviewStatus === "PENDING" ||
    reviewStatus === "REJECTED" ||
    reportSummary.reportCount > 0;

  if (!hasModerationState) {
    return null;
  }

  let tone = "neutral";
  let title = "";
  let message = "";

  if (status === "HIDDEN") {
    tone = "warning";
    title = "主题当前已被隐藏";
    if (reportSummary.reportResolutionNote) {
      message = `处理说明：${reportSummary.reportResolutionNote}`;
    } else if (reportSummary.reportPendingCount > 0) {
      message = `当前有 ${reportSummary.reportPendingCount} 条待处理投诉，管理员正在复核这条内容。`;
    } else if (reviewStatus === "REJECTED" && metadata.reviewReason) {
      message = `审核原因：${metadata.reviewReason}`;
    } else {
      message = "这条主题目前不会在公开内容流中展示，你可以调整内容后再继续发布。";
    }
  } else if (reviewStatus === "REJECTED") {
    tone = "warning";
    title = "主题暂未通过审核";
    message = metadata.reviewReason
      ? `审核原因：${metadata.reviewReason}`
      : "管理员已驳回当前内容，修改后可重新发布。";
  } else if (reviewStatus === "PENDING") {
    tone = "neutral";
    title = "主题正在审核中";
    message = "审核完成前，这条内容不会进入公开内容流。";
  } else if (reportSummary.reportPendingCount > 0) {
    tone = "warning";
    title = "主题正在被投诉核查";
    message = reportSummary.lastReportedReason
      ? `最近一条投诉原因：${reportSummary.lastReportedReason}`
      : `当前有 ${reportSummary.reportPendingCount} 条待处理投诉，管理员正在复核。`;
  } else if (reportSummary.reportStatus === "RESOLVED") {
    tone = "success";
    title = "投诉处理已完成";
    message = reportSummary.reportResolutionNote || "管理员已经完成投诉处理，如需补充可继续调整内容。";
  } else if (reportSummary.reportStatus === "IGNORED") {
    tone = "neutral";
    title = "投诉已复核";
    message = reportSummary.reportResolutionNote || "管理员已复核当前内容，暂未做下架处理。";
  } else if (status === "DRAFT") {
    tone = "neutral";
    title = "主题当前仍是草稿";
    message = "草稿不会出现在星球内容流里，发布后才会对其他成员可见。";
  }

  if (!title && !message) {
    return null;
  }

  return {
    role: isAuthor ? "AUTHOR" : "MANAGER",
    tone,
    title,
    message,
    status,
    statusLabel: mapPostStatusLabel(status),
    reviewStatus: reviewStatus || "UNSET",
    reviewStatusLabel: mapReviewStatusLabel(reviewStatus),
    reviewReason: metadata.reviewReason || "",
    reportStatus: reportSummary.reportStatus || "UNSET",
    reportStatusLabel: mapReportStatusLabel(reportSummary.reportStatus),
    reportTotal: reportSummary.reportCount,
    reportPendingCount: reportSummary.reportPendingCount,
    latestReportedAt: reportSummary.lastReportedAt,
    latestReportReason: reportSummary.lastReportedReason,
    reportResolutionNote: reportSummary.reportResolutionNote,
    canEdit: Boolean(isAuthor && status !== "DELETED"),
  };
}

function extractPostCover(post) {
  const metadata = post.metadata && typeof post.metadata === "object" ? post.metadata : {};
  const explicitCoverUrl =
    typeof metadata.coverUrl === "string"
      ? metadata.coverUrl.trim()
      : typeof metadata.coverImageUrl === "string"
        ? metadata.coverImageUrl.trim()
        : "";

  if (isAssetUrlValue(explicitCoverUrl)) {
    return explicitCoverUrl;
  }

  const attachments = Array.isArray(post.attachments) ? post.attachments : [];

  for (const item of attachments) {
    if (typeof item === "string" && isAssetUrlValue(item.trim()) && !isVideoAssetUrl(item.trim())) {
      return item.trim();
    }

    if (
      item &&
      typeof item === "object" &&
      typeof item.url === "string" &&
      isAssetUrlValue(item.url.trim()) &&
      !isVideoAssetUrl(item.url.trim())
    ) {
      return item.url.trim();
    }
  }

  const metadataImages = Array.isArray(metadata.images) ? metadata.images : [];

  for (const item of metadataImages) {
    if (typeof item === "string" && isAssetUrlValue(item.trim())) {
      return item.trim();
    }
  }

  const videoAttachments = Array.isArray(metadata.videoAttachments) ? metadata.videoAttachments : [];

  for (const item of videoAttachments) {
    if (
      item &&
      typeof item === "object" &&
      typeof item.poster === "string" &&
      isAssetUrlValue(item.poster.trim())
    ) {
      return item.poster.trim();
    }
  }

  if (post.group) {
    return post.group.coverUrl || post.group.avatarUrl || "";
  }

  return "";
}

async function getGroupHome(groupId, options = {}) {
  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const viewer = await getCurrentViewer(options.sessionToken, options.userId);
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      owner: {
        include: {
          profile: true,
        },
      },
      permissionPolicy: true,
    },
  });

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  if (group.status === "CLOSED") {
    return { statusCode: 404, payload: { ok: false, message: "星球已删除" } };
  }

  const paywallHighlights = getPaywallHighlightSnapshot(groupId);
  let shareMiniCodeUrl = "";

  try {
    shareMiniCodeUrl = await ensurePlanetShareMiniCode(group.id);
  } catch (error) {
    console.error("[contentService] failed to prepare planet share mini code", {
      groupId: group.id,
      message: error && error.message ? error.message : error,
    });
  }

  const [membership, staff, subscription, renewalSetting] = await Promise.all([
    viewer
      ? prisma.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId: viewer.id,
            },
          },
        })
      : Promise.resolve(null),
    viewer
      ? prisma.groupStaff.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId: viewer.id,
            },
          },
        })
      : Promise.resolve(null),
    viewer
      ? prisma.groupNotificationSubscription.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId: viewer.id,
            },
          },
          select: {
            enabled: true,
          },
        })
      : Promise.resolve(null),
    group.joinType === "FREE" ? Promise.resolve(null) : findGroupRenewalSetting(groupId),
  ]);

  const activeMembership = Boolean(
    membership &&
      membership.status === "ACTIVE" &&
      (!membership.expireAt || new Date(membership.expireAt).getTime() > Date.now())
  );
  const membershipSnapshot =
    viewer && viewer.id ? (await getJoinMembershipStatus(groupId, viewer.id)).payload.data : null;
  const isOwner = group.ownerUserId === (viewer ? viewer.id : "");
  const renewal = buildGroupRenewalSnapshot({
    group,
    membership,
    membershipSnapshot,
    isOwner,
    setting: renewalSetting,
  });
  const preferredRenewalCoupon = renewal.canRenew ? await findPreferredRenewalCoupon(groupId) : null;
  const renewalSnapshot = applyPreferredRenewalCoupon(renewal, preferredRenewalCoupon);

  const latestCount = await prisma.post.count({
    where: {
      groupId,
      status: "PUBLISHED",
    },
  });

  const featuredCount = await prisma.post.count({
    where: {
      groupId,
      status: "PUBLISHED",
      isEssence: true,
    },
  });

  const fileCount = await prisma.post.count({
    where: {
      groupId,
      status: "PUBLISHED",
      metadata: {
        path: ["hasFile"],
        equals: true,
      },
    },
  }).catch(() => 0);

  const answerCount = await prisma.post.count({
    where: {
      groupId,
      status: "PUBLISHED",
      metadata: {
        path: ["answerStatus"],
        equals: "PENDING",
      },
    },
  }).catch(() => 0);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          intro: group.intro || "",
          description: group.description || "",
          avatarUrl: group.avatarUrl || "",
          coverUrl: group.coverUrl || "",
          status: group.status,
          joinType: group.joinType,
          billingPeriod: group.billingPeriod,
          priceAmount: Number(group.priceAmount),
          originalPriceAmount: Number(group.originalPriceAmount),
          memberCount: group.memberCount,
          paidMemberCount: group.paidMemberCount,
          contentCount: group.contentCount,
          shareMiniCodeUrl,
          publishedAt: toOptionalDateString(group.publishedAt),
          createdAt: toOptionalDateString(group.createdAt),
        },
        owner: {
          id: group.owner.id,
          nickname: group.owner.profile ? group.owner.profile.nickname : "未知",
          avatarUrl: group.owner.profile ? group.owner.profile.avatarUrl || "" : "",
          bio: group.owner.profile ? group.owner.profile.bio || "" : "",
        },
        viewer: viewer
          ? {
              id: viewer.id,
              nickname: viewer.profile ? viewer.profile.nickname : "",
              avatarUrl: viewer.profile ? viewer.profile.avatarUrl || "" : "",
              subscriptionEnabled: Boolean(subscription && subscription.enabled),
            }
          : null,
        membership: membershipSnapshot
          ? {
              id: membership ? membership.id : "",
              status: membershipSnapshot.status,
              isActive: Boolean(membershipSnapshot.isActive),
              isPaid: membership ? membership.isPaid : false,
              expireAt:
                membershipSnapshot.expireAt && typeof membershipSnapshot.expireAt === "string"
                  ? membershipSnapshot.expireAt
                  : toOptionalDateString(membershipSnapshot.expireAt),
              joinedAt:
                membership && membership.joinedAt
                  ? toOptionalDateString(membership.joinedAt)
                  : membershipSnapshot.appliedAt && typeof membershipSnapshot.appliedAt === "string"
                    ? membershipSnapshot.appliedAt
                    : toOptionalDateString(membershipSnapshot.appliedAt),
              orderNo: membershipSnapshot.orderNo || "",
              reviewReason: membershipSnapshot.reviewReason || "",
              reviewedAt:
                membershipSnapshot.reviewedAt && typeof membershipSnapshot.reviewedAt === "string"
                  ? membershipSnapshot.reviewedAt
                  : toOptionalDateString(membershipSnapshot.reviewedAt),
            }
          : null,
        role: {
          isOwner,
          isStaff: Boolean(staff),
          staffRole: staff ? staff.role : null,
          canPublish: activeMembership || Boolean(staff) || isOwner,
          canManage: Boolean(staff) || isOwner,
        },
        renewal: renewalSnapshot,
        policy: group.permissionPolicy
          ? {
              allowJoin: group.permissionPolicy.allowJoin,
              needExamine: group.permissionPolicy.needExamine,
              allowPreview: group.permissionPolicy.allowPreview,
              allowSearch: group.permissionPolicy.allowSearch,
            }
          : null,
        paywallHighlights,
        stats: {
          latestCount,
          featuredCount,
          fileCount,
          answerCount,
        },
      },
    },
  };
}

async function listPostsByTab(groupId, input = {}) {
  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const viewerId = await resolveViewerIdentity(input.sessionToken, input.userId || "");
  const tab = input.tab || "latest";
  const limitValue = Number(input.limit || 20);
  const take = Number.isFinite(limitValue) ? Math.min(Math.max(Math.floor(limitValue), 1), 50) : 20;
  const cursor = parseCursor(input.cursor);
  let answerTabAccess = null;
  const managerAccess = await getGroupManagerAccess(groupId, viewerId);

  if (tab === "answer" && viewerId) {
    answerTabAccess = {
      isOwner: managerAccess.isOwner,
      isStaff: managerAccess.isStaff,
    };
  }

  const where = {
    groupId,
    status: "PUBLISHED",
  };

  if (tab === "featured") {
    where.isEssence = true;
  }

  if (tab === "files") {
    where.metadata = {
      path: ["hasFile"],
      equals: true,
    };
  }

  if (tab === "answer") {
    where.AND = [
      {
        metadata: {
          path: ["publishType"],
          equals: "question",
        },
      },
      {
        metadata: {
          path: ["answerStatus"],
          equals: "PENDING",
        },
      },
    ];

    if (viewerId) {
      const canViewAllPendingQuestions = Boolean(answerTabAccess && (answerTabAccess.isOwner || answerTabAccess.isStaff));

      if (!canViewAllPendingQuestions) {
        where.AND.push({
          metadata: {
            path: ["questionTargetId"],
            equals: viewerId,
          },
        });
      }
    }
  }

  const fetchTake = managerAccess.canManage ? take : Math.min(Math.max(take * 3, take), 120);

  const posts = await prisma.post.findMany({
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
      likes: buildViewerLikeInclude(viewerId),
    },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    take: fetchTake,
  }).catch(async () => {
    return prisma.post.findMany({
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
        likes: buildViewerLikeInclude(viewerId),
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      take: fetchTake,
    });
  });

  const visiblePosts = filterPostsForViewerVisibility(posts, managerAccess.canManage);
  const items = visiblePosts.slice(0, take);
  const viewerUnlockArticleIdSet = await loadViewerArticleUnlockIdSet(
    items.filter((post) => post.type === "ARTICLE").map((post) => post.id),
    viewerId
  );
  const summaryItems = items.map((post) =>
    applyReadAccessToPostSummary(
      toPostSummary(post),
      post,
      {
        viewerId,
        isAuthor: Boolean(viewerId && viewerId === post.authorUserId),
        canManage: managerAccess.canManage,
        isUnlocked: viewerUnlockArticleIdSet.has(post.id),
      }
    )
  );
  const nextCursor =
    visiblePosts.length > take
      ? items[items.length - 1].id
      : posts.length === fetchTake
        ? posts[posts.length - 1].id
        : null;

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        items: summaryItems,
        nextCursor,
        tab,
      },
    },
  };
}

async function listPinnedPosts(groupId) {
  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const options = arguments[1] || {};
  const viewerId = await resolveViewerIdentity(options.sessionToken, options.userId || "");
  const managerAccess = await getGroupManagerAccess(groupId, viewerId);
  const posts = await prisma.post.findMany({
    where: {
      groupId,
      status: "PUBLISHED",
      isPinned: true,
    },
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
      likes: buildViewerLikeInclude(viewerId),
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  const visiblePosts = filterPostsForViewerVisibility(posts, managerAccess.canManage).slice(0, 20);
  const viewerUnlockArticleIdSet = await loadViewerArticleUnlockIdSet(
    visiblePosts.filter((post) => post.type === "ARTICLE").map((post) => post.id),
    viewerId
  );
  const summaryItems = visiblePosts.map((post) =>
    applyReadAccessToPostSummary(
      toPostSummary(post),
      post,
      {
        viewerId,
        isAuthor: Boolean(viewerId && viewerId === post.authorUserId),
        canManage: managerAccess.canManage,
        isUnlocked: viewerUnlockArticleIdSet.has(post.id),
      }
    )
  );

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: summaryItems,
    },
  };
}

async function listDiscoverFeaturedPosts(input = {}) {
  const limitValue = Number(input.limit || 12);
  const take = Number.isFinite(limitValue) ? Math.min(Math.max(Math.floor(limitValue), 1), 30) : 12;
  const viewerId = await resolveViewerIdentity(input.sessionToken, input.userId || "");

  const activeMemberships = viewerId
    ? await prisma.groupMember.findMany({
        where: {
          userId: viewerId,
          status: "ACTIVE",
        },
        select: {
          groupId: true,
          status: true,
          expireAt: true,
        },
      })
    : [];

  const excludedGroupIds = activeMemberships
    .filter((membership) => membershipIsActive(membership))
    .map((membership) => membership.groupId);

  const where = {
    status: "PUBLISHED",
    isEssence: true,
    publishedAt: {
      not: null,
    },
    group: {
      status: "ACTIVE",
      publishedAt: {
        not: null,
      },
      permissionPolicy: {
        is: {
          allowJoin: true,
          allowPreview: true,
          allowSearch: true,
        },
      },
    },
  };

  if (viewerId) {
    where.group.ownerUserId = {
      not: viewerId,
    };
  }

  if (excludedGroupIds.length) {
    where.groupId = {
      notIn: excludedGroupIds,
    };
  }

  const fetchTake = Math.min(Math.max(take * 3, take), 90);
  const posts = await prisma.post.findMany({
    where,
    include: {
      author: {
        include: {
          profile: true,
        },
      },
      group: {
        include: {
          owner: {
            include: {
              profile: true,
            },
          },
        },
      },
      likes: buildViewerLikeInclude(viewerId),
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: fetchTake,
  });
  const visiblePosts = filterPostsForViewerVisibility(posts, false).slice(0, take);
  const viewerUnlockArticleIdSet = await loadViewerArticleUnlockIdSet(
    visiblePosts.filter((post) => post.type === "ARTICLE").map((post) => post.id),
    viewerId
  );
  const summaryItems = visiblePosts.map((post) => {
    const readAwareSummary = applyReadAccessToPostSummary(
      toPostSummary(post),
      post,
      {
        viewerId,
        isAuthor: Boolean(viewerId && viewerId === post.authorUserId),
        canManage: false,
        isUnlocked: viewerUnlockArticleIdSet.has(post.id),
      }
    );

    return {
      ...readAwareSummary,
      group: {
        id: post.group.id,
        name: post.group.name,
        ownerName: post.group.owner && post.group.owner.profile ? post.group.owner.profile.nickname : "未知",
        coverUrl: post.group.coverUrl || post.group.avatarUrl || "",
      },
      coverUrl: extractPostCover(post),
    };
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: summaryItems,
    },
  };
}

async function getPostDetail(postId, options = {}) {
  if (!postId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子ID" } };
  }

  const viewerId = await resolveViewerIdentity(options.sessionToken, options.userId || "");
  const existingPost = await prisma.post.findUnique({
    where: { id: postId },
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
      likes: buildViewerLikeInclude(viewerId),
    },
  });

  if (!existingPost || existingPost.status === "DELETED") {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  const metadata = normalizeMetadata(existingPost.metadata || {});

  if (!(await canViewerReadPost(existingPost, viewerId))) {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  const post =
    options.incrementRead === false
      ? existingPost
      : await prisma.post.update({
          where: { id: postId },
          data: {
            readingCount: {
              increment: 1,
            },
          },
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
        likes: buildViewerLikeInclude(viewerId),
      },
    }).catch(() => existingPost);

  const managerAccess = await getGroupManagerAccess(post.groupId, viewerId);
  const viewerUnlockArticleIdSet = await loadViewerArticleUnlockIdSet([post.id], viewerId);
  const postSummary = applyReadAccessToPostSummary(
    toPostSummary(post),
    post,
    {
      viewerId,
      isAuthor: Boolean(viewerId && viewerId === post.authorUserId),
      canManage: managerAccess.canManage,
      isUnlocked: viewerUnlockArticleIdSet.has(post.id),
    },
    {
      includeParagraphs: true,
    }
  );
  const viewerModeration = await buildViewerPostModeration(post, viewerId);

  // 如果帖子有关联的专栏，获取专栏标题
  const columnId = metadata.columnId;
  
  if (columnId && typeof columnId === "string") {
    const column = await prisma.column.findUnique({
      where: { id: columnId },
      select: { title: true },
    });
    
    if (column) {
      postSummary.metadata = {
        ...postSummary.metadata,
        columnTitle: column.title,
      };
    }
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        ...postSummary,
        viewerModeration,
      },
    },
  };
}

async function createPost(input = {}) {
  const {
    groupId,
    userId: inputUserId,
    sessionToken,
    title,
    summary,
    contentText,
    attachments,
    metadata,
    isEssence,
    isPinned,
  } = input;
  const userId = await resolveViewerIdentity(sessionToken, inputUserId);

  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "缺少用户身份" } };
  }

  const normalizedContent = String(contentText || summary || title || "").trim();
  const normalizedAttachments = normalizeAttachmentList(attachments);
  const normalizedMetadata = normalizeMetadata(metadata);
  if (normalizedMetadata.publishType === "question") {
    normalizedMetadata.answerStatus =
      normalizedMetadata.answerStatus && String(normalizedMetadata.answerStatus).trim()
        ? normalizedMetadata.answerStatus
        : "PENDING";
  }
  if (!normalizedContent && !normalizedAttachments.length && !hasEmbeddedPostMedia(normalizedMetadata)) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子内容或附件" } };
  }

  const [group, user, membership, staff] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId } }),
    prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
    prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    }),
    prisma.groupStaff.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    }),
  ]);

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  if (!user) {
    return { statusCode: 404, payload: { ok: false, message: "用户不存在" } };
  }

  const canPublish = Boolean(
    group.ownerUserId === userId ||
      staff ||
      (membership && membership.status === "ACTIVE" && (!membership.expireAt || new Date(membership.expireAt).getTime() > Date.now()))
  );

  if (!canPublish) {
    return { statusCode: 403, payload: { ok: false, message: "当前用户无权在该星球发帖" } };
  }

  const articleMetadata = finalizeArticleMetadataForWrite(normalizedMetadata, {
    postType: input.type || "TOPIC",
    group,
    author: user,
  });

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.post.create({
      data: {
        groupId,
        authorUserId: userId,
        type: input.type || "TOPIC",
        status: "PUBLISHED",
        title: String(title || "").trim() || null,
        summary: String(summary || normalizedContent.slice(0, 120) || title || articleMetadata.fileName || "").trim() || null,
        contentText: normalizedContent,
        isEssence: Boolean(isEssence),
        isPinned: Boolean(isPinned),
        publishedAt: new Date(),
        attachments: normalizedAttachments,
        metadata: articleMetadata,
      },
      include: {
        author: {
          include: {
            profile: true,
          },
        },
        likes: buildViewerLikeInclude(userId),
      },
    });

    await tx.group.update({
      where: { id: groupId },
      data: {
        contentCount: {
          increment: 1,
        },
      },
    });

    const subscribedCount = await tx.groupNotificationSubscription.count({
      where: {
        groupId,
        enabled: true,
        userId: {
          not: userId,
        },
      },
    });

    if (subscribedCount > 0) {
      const notificationTitle = String(title || "").trim() || "星球有新文章更新";
      const notificationContent = String(summary || normalizedContent || "").trim().slice(0, 120) || "点击查看刚刚发布的新内容。";

      await tx.groupNotification.create({
        data: {
          groupId,
          title: notificationTitle,
          content: notificationContent,
          buttonText: "查看内容",
          buttonUrl: `/pages/planet/post?id=${created.id}&planetId=${groupId}`,
          routeKey: "planet_post",
          status: "SENT",
          sentAt: new Date(),
          pushedCount: subscribedCount,
        },
      });
    }

    return created;
  });

  return {
    statusCode: 201,
    payload: {
      ok: true,
      data: toPostSummary(post),
    },
  };
}

async function updatePost(input = {}) {
  const {
    postId,
    userId: inputUserId,
    sessionToken,
    title,
    summary,
    contentText,
    attachments,
    metadata,
    isPinned,
    isEssence,
  } = input;
  const userId = await resolveViewerIdentity(sessionToken, inputUserId);

  if (!postId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子ID" } };
  }

  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "缺少用户身份" } };
  }

  const existingPost = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: {
        include: {
          profile: true,
        },
      },
    },
  });

  if (!existingPost || existingPost.status === "DELETED") {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  const group = await prisma.group.findUnique({
    where: { id: existingPost.groupId },
  });

  const staff = await prisma.groupStaff.findUnique({
    where: {
      groupId_userId: {
        groupId: existingPost.groupId,
        userId,
      },
    },
  });

  const isAuthor = existingPost.authorUserId === userId;
  const canManage = Boolean(group && (group.ownerUserId === userId || staff));

  if (!isAuthor && !canManage) {
    return { statusCode: 403, payload: { ok: false, message: "当前用户无权修改帖子" } };
  }

  if ((isPinned !== undefined || isEssence !== undefined) && !canManage) {
    return { statusCode: 403, payload: { ok: false, message: "只有星主或管理员可以操作置顶/精华" } };
  }

  const normalizedContent = String(
    contentText ?? summary ?? title ?? existingPost.contentText ?? existingPost.summary ?? existingPost.title ?? ""
  ).trim();
  const normalizedAttachments =
    attachments !== undefined ? normalizeAttachmentList(attachments) : existingPost.attachments;
  const normalizedMetadata =
    metadata !== undefined
      ? normalizeMetadata({
          ...normalizeMetadata(existingPost.metadata || {}),
          ...metadata,
        })
      : normalizeMetadata(existingPost.metadata || {});
  const finalizedMetadata = finalizeArticleMetadataForWrite(normalizedMetadata, {
    postType: existingPost.type,
    group,
    author: existingPost.author,
  });

  if (!normalizedContent && !normalizedAttachments.length && !hasEmbeddedPostMedia(finalizedMetadata)) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子内容或附件" } };
  }

  if (finalizedMetadata.publishType === "question") {
    finalizedMetadata.answerStatus =
      finalizedMetadata.answerStatus && String(finalizedMetadata.answerStatus).trim()
        ? finalizedMetadata.answerStatus
        : "PENDING";
  }

  const updatedPost = await prisma.post.update({
    where: { id: postId },
    data: {
      title: title !== undefined ? String(title || "").trim() || null : existingPost.title,
      summary:
        summary !== undefined
          ? String(summary || normalizedContent.slice(0, 120) || title || finalizedMetadata.fileName || "").trim() || null
          : existingPost.summary,
      contentText: normalizedContent,
      attachments: normalizedAttachments,
      metadata: finalizedMetadata,
      isPinned: isPinned !== undefined ? Boolean(isPinned) : existingPost.isPinned,
      isEssence: isEssence !== undefined ? Boolean(isEssence) : existingPost.isEssence,
      updatedAt: new Date(),
    },
    include: {
      author: {
        include: {
          profile: true,
        },
      },
      likes: buildViewerLikeInclude(userId),
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: toPostSummary(updatedPost),
    },
  };
}

async function reportPost(input = {}) {
  const { postId, reason, userId: inputUserId, sessionToken } = input;
  const viewer = await getCurrentViewer(sessionToken, inputUserId);

  if (!postId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子ID" } };
  }

  if (!viewer || !viewer.id) {
    return { statusCode: 401, payload: { ok: false, message: "请先登录后再投诉" } };
  }

  const normalizedReason = String(reason || "").trim();
  if (!normalizedReason) {
    return { statusCode: 400, payload: { ok: false, message: "请输入投诉原因" } };
  }

  if (normalizedReason.length > 120) {
    return { statusCode: 400, payload: { ok: false, message: "投诉原因不能超过120个字" } };
  }

  const existingPost = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      groupId: true,
      authorUserId: true,
      status: true,
      metadata: true,
    },
  });

  if (!existingPost || existingPost.status === "DELETED") {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  if (!(await canViewerReadPost(existingPost, viewer.id))) {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  if (existingPost.authorUserId === viewer.id) {
    return { statusCode: 400, payload: { ok: false, message: "不能投诉自己发布的内容" } };
  }

  const metadata = normalizeMetadata(existingPost.metadata || {});
  const currentReportSummary = buildPostReportMetadata(metadata);
  const hasPendingReport = currentReportSummary.reportLogs.some(
    (item) =>
      item.reporterUserId === viewer.id && normalizePostReportStatus(item.status) === "PENDING"
  );

  if (hasPendingReport) {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          postId: existingPost.id,
          reportStatus: currentReportSummary.reportStatus || "PENDING",
          reportCount: currentReportSummary.reportCount,
          reportPendingCount: currentReportSummary.reportPendingCount,
          idempotent: true,
        },
      },
    };
  }

  const now = new Date().toISOString();
  const reportLog = {
    id: createPostReportLogId(),
    reporterUserId: viewer.id,
    reporterName:
      viewer.profile && typeof viewer.profile.nickname === "string" && viewer.profile.nickname.trim()
        ? viewer.profile.nickname.trim()
        : "当前成员",
    reason: normalizedReason,
    status: "PENDING",
    createdAt: now,
    resolvedAt: "",
    resolutionNote: "",
  };
  const nextMetadata = {
    ...metadata,
    reportLogs: currentReportSummary.reportLogs.concat(reportLog),
    reportStatus: "PENDING",
    lastReportedAt: now,
    lastReportedReason: normalizedReason,
    reportResolutionNote: "",
  };
  const nextReportSummary = buildPostReportMetadata(nextMetadata);
  applyPostReportMetadata(nextMetadata, nextReportSummary);

  await prisma.post.update({
    where: { id: existingPost.id },
    data: {
      metadata: nextMetadata,
      updatedAt: new Date(),
    },
  });

  return {
    statusCode: 201,
    payload: {
      ok: true,
      data: {
        postId: existingPost.id,
        reportStatus: nextReportSummary.reportStatus,
        reportCount: nextReportSummary.reportCount,
        reportPendingCount: nextReportSummary.reportPendingCount,
        idempotent: false,
      },
    },
  };
}

async function assignPostColumn(input = {}) {
  const { postId, columnId, userId: inputUserId, sessionToken } = input;
  const userId = await resolveViewerIdentity(sessionToken, inputUserId);

  if (!postId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子ID" } };
  }

  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "请先登录" } };
  }

  const existingPost = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      groupId: true,
      status: true,
      metadata: true,
    },
  });

  if (!existingPost || existingPost.status === "DELETED") {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  const group = await prisma.group.findUnique({
    where: { id: existingPost.groupId },
    select: {
      id: true,
      ownerUserId: true,
    },
  });

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  if (group.ownerUserId !== userId) {
    return { statusCode: 403, payload: { ok: false, message: "只有星主可以管理帖子专栏" } };
  }

  let targetColumn = null;
  const normalizedColumnId = String(columnId || "").trim();

  if (normalizedColumnId) {
    targetColumn = await prisma.column.findFirst({
      where: {
        id: normalizedColumnId,
        groupId: existingPost.groupId,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!targetColumn) {
      return { statusCode: 404, payload: { ok: false, message: "专栏不存在或不属于当前星球" } };
    }
  }

  const nextMetadata = normalizeMetadata(existingPost.metadata || {});

  if (targetColumn) {
    nextMetadata.columnId = targetColumn.id;
    nextMetadata.columnTitle = targetColumn.title;
  } else {
    delete nextMetadata.columnId;
    delete nextMetadata.columnTitle;
  }

  const updatedPost = await prisma.post.update({
    where: { id: postId },
    data: {
      metadata: nextMetadata,
      updatedAt: new Date(),
    },
    include: {
      author: {
        include: {
          profile: true,
        },
      },
      likes: buildViewerLikeInclude(userId),
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: toPostSummary(updatedPost),
    },
  };
}

async function deletePost(input = {}) {
  const { postId, userId: inputUserId, sessionToken } = input;
  const userId = await resolveViewerIdentity(sessionToken, inputUserId);

  if (!postId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子ID" } };
  }

  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "缺少用户身份" } };
  }

  const existingPost = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!existingPost || existingPost.status === "DELETED") {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  const group = await prisma.group.findUnique({
    where: { id: existingPost.groupId },
  });

  const staff = await prisma.groupStaff.findUnique({
    where: {
      groupId_userId: {
        groupId: existingPost.groupId,
        userId,
      },
    },
  });

  const canDelete = existingPost.authorUserId === userId || Boolean(group && (group.ownerUserId === userId || staff));

  if (!canDelete) {
    return { statusCode: 403, payload: { ok: false, message: "当前用户无权删除帖子" } };
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: {
        status: "DELETED",
        updatedAt: new Date(),
      },
    });

    await tx.group.update({
      where: { id: existingPost.groupId },
      data: {
        contentCount: {
          decrement: 1,
        },
      },
    });
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      message: "帖子已删除",
    },
  };
}

async function listComments(postId) {
  const options = arguments[1] || {};
  const viewerId = await resolveViewerIdentity(options.sessionToken, options.userId || "");
  if (!postId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子ID" } };
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      groupId: true,
      authorUserId: true,
      status: true,
      metadata: true,
    },
  });

  if (!post || !(await canViewerReadPost(post, viewerId))) {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  const comments = await prisma.comment.findMany({
    where: {
      postId,
      status: "PUBLISHED",
    },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
      likes: buildViewerLikeInclude(viewerId),
    },
    orderBy: [{ createdAt: "asc" }],
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: comments.map(toCommentItem),
    },
  };
}

async function createComment(input = {}) {
  const { postId, userId: inputUserId, sessionToken, content, parentId, attachments } = input;
  const userId = await resolveViewerIdentity(sessionToken, inputUserId);

  if (!postId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子ID" } };
  }

  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "缺少用户身份" } };
  }

  const normalizedContent = String(content || "").trim();
  const normalizedAttachments = normalizeAttachmentList(attachments);
  if (!normalizedContent && !normalizedAttachments.length) {
    return { statusCode: 400, payload: { ok: false, message: "评论内容不能为空" } };
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  if (!(await canViewerReadPost(post, userId))) {
    return { statusCode: 403, payload: { ok: false, message: "当前用户无权评论该帖子" } };
  }

  const membership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: post.groupId,
        userId,
      },
    },
  });

  const staff = await prisma.groupStaff.findUnique({
    where: {
      groupId_userId: {
        groupId: post.groupId,
        userId,
      },
    },
  });

  const group = await prisma.group.findUnique({ where: { id: post.groupId } });
  const canComment = Boolean(
    group &&
      (group.ownerUserId === userId ||
        staff ||
        (membership && membership.status === "ACTIVE" && (!membership.expireAt || new Date(membership.expireAt).getTime() > Date.now())))
  );

  if (!canComment) {
    return { statusCode: 403, payload: { ok: false, message: "当前用户无权评论该帖子" } };
  }

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        postId,
        userId,
        parentId: parentId || null,
        contentText: normalizedContent,
        attachments: normalizedAttachments,
        status: "PUBLISHED",
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        likes: buildViewerLikeInclude(userId),
      },
    });

    await tx.post.update({
      where: { id: postId },
      data: {
        commentCount: {
          increment: 1,
        },
      },
    });

    return created;
  });

  return {
    statusCode: 201,
    payload: {
      ok: true,
      data: toCommentItem(comment),
    },
  };
}

async function listMyPosts(sessionToken) {
  const userId = await resolveViewerIdentity(sessionToken, "");

  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "请先登录" } };
  }

  const posts = await prisma.post.findMany({
    where: {
      authorUserId: userId,
      status: {
        not: "DELETED",
      },
    },
    include: {
      author: {
        include: {
          profile: true,
        },
      },
      group: true,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  const items = await Promise.all(
    posts.map(async (post) => ({
      ...toPostSummary(post),
      group: post.group
        ? {
            id: post.group.id,
            name: post.group.name,
          }
        : null,
      viewerModeration: await buildViewerPostModeration(post, userId),
    }))
  );

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: items,
    },
  };
}

async function togglePostLike(postId, increment = true) {
  const options = arguments[2] || {};
  const userId = await resolveViewerIdentity(options.sessionToken, options.userId || "");
  if (!postId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子ID" } };
  }

  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "请先登录后点赞" } };
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      groupId: true,
      authorUserId: true,
      status: true,
      metadata: true,
    },
  });
  if (!post) {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  if (!(await canViewerReadPost(post, userId))) {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existingLike = await tx.postLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    if (increment && !existingLike) {
      await tx.postLike.create({
        data: {
          postId,
          userId,
        },
      });
    }

    if (!increment && existingLike) {
      await tx.postLike.delete({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });
    }

    const nextLikeCount = await tx.postLike.count({
      where: {
        postId,
      },
    });

    return tx.post.update({
      where: { id: postId },
      data: {
        likeCount: nextLikeCount,
      },
      include: {
        author: {
          include: {
            profile: true,
          },
        },
        likes: buildViewerLikeInclude(userId),
      },
    });
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: toPostSummary(updated),
    },
  };
}

async function toggleCommentLike(commentId, increment = true, options = {}) {
  const userId = await resolveViewerIdentity(options.sessionToken, options.userId || "");

  if (!commentId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少评论ID" } };
  }

  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "请先登录后点赞" } };
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: {
      post: {
        select: {
          id: true,
          groupId: true,
          authorUserId: true,
          status: true,
          metadata: true,
        },
      },
    },
  });

  if (!comment || !comment.post) {
    return { statusCode: 404, payload: { ok: false, message: "评论不存在" } };
  }

  if (!(await canViewerReadPost(comment.post, userId))) {
    return { statusCode: 404, payload: { ok: false, message: "评论不存在" } };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existingLike = await tx.commentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
    });

    if (increment && !existingLike) {
      await tx.commentLike.create({
        data: {
          commentId,
          userId,
        },
      });
    }

    if (!increment && existingLike) {
      await tx.commentLike.delete({
        where: {
          commentId_userId: {
            commentId,
            userId,
          },
        },
      });
    }

    const nextLikeCount = await tx.commentLike.count({
      where: {
        commentId,
      },
    });

    return tx.comment.update({
      where: { id: commentId },
      data: {
        likeCount: nextLikeCount,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        likes: buildViewerLikeInclude(userId),
      },
    });
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: toCommentItem(updated),
    },
  };
}

module.exports = {
  getGroupHome,
  listPostsByTab,
  listPinnedPosts,
  listDiscoverFeaturedPosts,
  getPostDetail,
  createPost,
  updatePost,
  reportPost,
  assignPostColumn,
  deletePost,
  listComments,
  createComment,
  togglePostLike,
  toggleCommentLike,
  listMyPosts,
  resolveViewerIdentity,
  getGroupManagerAccess,
};
