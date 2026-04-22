const fs = require("fs");
const path = require("path");
const { prisma } = require("../db/prisma");
const { listGroupJoinReviewApplications, reviewJoinApplication } = require("./joinFlowService");
const { buildArticlePayload } = require("./articleModelService");
const { normalizePaywallHighlightUrl } = require("./paywallHighlightStore");
const { getRenewalSettingColumnNames, ensureRenewalSettingColumns } = require("./renewalSettingSchemaService");
const { generateUnlimitedMiniProgramCode, getMiniProgramCodeEnvVersion } = require("./wechatService");

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const DEFAULT_TREND_DAYS = 7;
const MAX_TREND_DAYS = 30;
const MEMBER_VERIFICATION_STATUS_KEYS = ["ACTIVE", "EXPIRED", "BANNED", "QUIT"];
const PROMOTION_CHANNEL_NAME_PATTERN = /^[\u4e00-\u9fa5A-Za-z0-9 ]+$/;
const UPLOAD_ROOT_PATH = path.join(__dirname, "..", "..", "uploads");
const PROMOTION_CHANNEL_MINI_CODE_DIR = path.join(UPLOAD_ROOT_PATH, "mini-program-codes", "promotion-channel");
const PROMOTION_CHANNEL_MINI_CODE_PAGE = "pages/planet/home";
const RENEWAL_DISCOUNT_AUDIENCE_KEYS = ["renewable_members", "expiring_members", "grace_members", "high_loyalty_members"];
const RENEWAL_DISCOUNT_STAGE_KEYS = ["advance", "expiring", "grace"];
const PAYWALL_HIGHLIGHT_STORE_PATH = path.join(__dirname, "..", "..", "temp", "admin-paywall-highlights.json");
const WEB_BOSS_MOBILE_ENV_KEYS = ["WEB_BOSS_MOBILE", "WEB_ADMIN_BOSS_MOBILE"];
const DEFAULT_DEV_WEB_BOSS_MOBILE = "18888888888";
const RENEWAL_SETTING_COLUMN_DEFINITIONS = [
  { key: "id", column: "id" },
  { key: "groupId", column: "group_id" },
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
  { key: "audience", column: "audience" },
  { key: "allowCouponStack", column: "allow_coupon_stack" },
  { key: "minRenewCount", column: "min_renew_count" },
  { key: "mode", column: "mode" },
  { key: "duration", column: "duration" },
  { key: "beginTime", column: "begin_time" },
  { key: "endTime", column: "end_time" },
  { key: "guidance", column: "guidance" },
  { key: "renewalUrl", column: "renewal_url" },
  { key: "createdAt", column: "created_at" },
  { key: "updatedAt", column: "updated_at" },
];
const RENEWAL_SETTING_WRITE_REQUIRED_COLUMNS = [
  "group_id",
  "enabled",
  "limit_window",
  "amount",
  "original_amount",
  "discounted_percentage",
  "expiring_enabled",
  "advance_amount",
  "advance_discount_percentage",
  "advance_enabled",
  "grace_amount",
  "grace_discount_percentage",
  "grace_enabled",
  "audience",
  "allow_coupon_stack",
  "min_renew_count",
  "mode",
  "duration",
  "begin_time",
  "end_time",
  "guidance",
  "renewal_url",
];
const SCOREBOARD_RULE_DEFINITIONS = [
  { eventType: "POST_PUBLISH", label: "发布主题", defaultScore: 5 },
  { eventType: "COMMENT_PUBLISH", label: "发表评论", defaultScore: 2 },
  { eventType: "CHECKIN_PUBLISH", label: "发布打卡", defaultScore: 4 },
  { eventType: "ASSIGNMENT_SUBMIT", label: "提交作业", defaultScore: 6 },
  { eventType: "POST_LIKE", label: "主题获赞", defaultScore: 1 },
  { eventType: "COMMENT_LIKE", label: "评论获赞", defaultScore: 1 },
];
const SCOREBOARD_RULE_EVENT_TYPE_SET = new Set(SCOREBOARD_RULE_DEFINITIONS.map((item) => item.eventType));

function parsePositiveInt(value, fallback, maxValue) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), maxValue);
}

function parseBooleanFlag(value, fallback = false) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizePhone(value) {
  const digits = normalizeString(value).replace(/\D/g, "");
  return /^1\d{10}$/.test(digits) ? digits : "";
}

function readFirstEnvValue(envKeys, normalizer = normalizeString) {
  for (const envKey of envKeys) {
    const normalizedValue = normalizer(process.env[envKey]);
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return "";
}

function resolveWebBossMobile() {
  const configuredMobile = readFirstEnvValue(WEB_BOSS_MOBILE_ENV_KEYS, normalizePhone);
  if (configuredMobile) {
    return configuredMobile;
  }

  return process.env.NODE_ENV !== "production" ? DEFAULT_DEV_WEB_BOSS_MOBILE : "";
}

function isWebBossSession(session) {
  const bossMobile = resolveWebBossMobile();
  if (!bossMobile || !session || !session.user) {
    return false;
  }

  return normalizePhone(session.user.mobile) === bossMobile;
}

function toIso(value) {
  return value ? new Date(value).toISOString() : "";
}

function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function parseDateOnly(value) {
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatStatDate(value) {
  const date = new Date(value);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${month}-${day}`;
}

function buildTrendRange(input = {}) {
  const rangeDays = parsePositiveInt(input.rangeDays, DEFAULT_TREND_DAYS, MAX_TREND_DAYS);
  const endDate = endOfDay(new Date());
  const startDate = startOfDay(new Date(endDate));
  startDate.setDate(startDate.getDate() - (rangeDays - 1));
  return {
    rangeDays,
    startDate,
    endDate,
  };
}

function ensureJsonStoreDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonStore(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallbackValue;
    }

    const rawValue = fs.readFileSync(filePath, "utf8").trim();
    if (!rawValue) {
      return fallbackValue;
    }

    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" ? parsed : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

function writeJsonStore(filePath, value) {
  ensureJsonStoreDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function normalizePaywallHighlightImage(item, index) {
  const url = normalizePaywallHighlightUrl(item && item.url ? item.url : "");
  if (!url || !/^(https?:\/\/|\/)/i.test(url)) {
    return null;
  }

  const name = String(item && item.name ? item.name : `亮点图${index + 1}`)
    .trim()
    .slice(0, 120);

  return {
    name: name || `亮点图${index + 1}`,
    url,
  };
}

function readPaywallHighlightStore() {
  return readJsonStore(PAYWALL_HIGHLIGHT_STORE_PATH, {});
}

function writePaywallHighlightStore(store) {
  writeJsonStore(PAYWALL_HIGHLIGHT_STORE_PATH, store);
}

async function findCompatibleRenewalSetting(groupId) {
  if (!groupId) {
    return null;
  }

  const columnNames = await getRenewalSettingColumnNames();
  if (!columnNames.size || !columnNames.has("group_id")) {
    return null;
  }

  const selectedColumns = RENEWAL_SETTING_COLUMN_DEFINITIONS.filter((item) => columnNames.has(item.column));
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

async function ensureRenewalSettingWriteCompatibility() {
  const { columnNames, missingColumns, addedColumns } = await ensureRenewalSettingColumns(
    RENEWAL_SETTING_WRITE_REQUIRED_COLUMNS
  );

  if (addedColumns.length) {
    console.info(`[renewal_settings] auto added columns for admin write: ${addedColumns.join(", ")}`);
  }

  if (missingColumns.length) {
    return {
      error: {
        statusCode: 409,
        payload: {
          ok: false,
          message: `当前数据库 renewal_settings 表缺少字段：${missingColumns.join(", ")}，请先执行数据库迁移后再保存续期配置`,
        },
      },
    };
  }

  return { columnNames };
}

function buildIncomeCalendarRanges(now = new Date()) {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const yesterdayStart = startOfDay(new Date(todayStart));
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = endOfDay(yesterdayStart);

  const currentWeekStart = startOfDay(new Date(todayStart));
  const currentWeekOffset = (currentWeekStart.getDay() + 6) % 7;
  currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekOffset);

  const lastWeekStart = startOfDay(new Date(currentWeekStart));
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = endOfDay(new Date(currentWeekStart));
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

  const currentMonthStart = startOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth(), 1));
  const lastMonthStart = startOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth() - 1, 1));
  const lastMonthEnd = endOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth(), 0));

  return {
    todayStart,
    todayEnd,
    yesterdayStart,
    yesterdayEnd,
    currentWeekStart,
    currentWeekEnd: todayEnd,
    lastWeekStart,
    lastWeekEnd,
    currentMonthStart,
    currentMonthEnd: todayEnd,
    lastMonthStart,
    lastMonthEnd,
  };
}

function addCalendarMonths(date, offset) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + offset);
  return nextDate;
}

function buildMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function buildMonthLabel(date) {
  return `${date.getMonth() + 1}月`;
}

function buildFutureExpireBuckets(rows, startDate, bucketCount = 12) {
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketDate = new Date(startDate.getFullYear(), startDate.getMonth() + index, 1);
    return {
      month: buildMonthKey(bucketDate),
      label: buildMonthLabel(bucketDate),
      count: 0,
    };
  });

  const bucketMap = new Map(buckets.map((item) => [item.month, item]));
  rows.forEach((row) => {
    if (!row || !row.expireAt) {
      return;
    }

    const expireAt = new Date(row.expireAt);
    const matchedBucket = bucketMap.get(buildMonthKey(expireAt));
    if (matchedBucket) {
      matchedBucket.count += 1;
    }
  });

  return buckets;
}

function sumDailyStatValue(rows, rangeStart, rangeEnd, pickValue) {
  const startTime = rangeStart.getTime();
  const endTime = rangeEnd.getTime();

  return rows.reduce((sum, row) => {
    const statTime = startOfDay(new Date(row.statDate)).getTime();
    if (statTime < startTime || statTime > endTime) {
      return sum;
    }

    return sum + toNumber(pickValue(row));
  }, 0);
}

function resolvePaidOrderDate(order) {
  if (!order) {
    return null;
  }

  const value = order.paidAt || order.createdAt;
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sumOrderValue(rows, rangeStart, rangeEnd, pickValue) {
  const startTime = rangeStart.getTime();
  const endTime = rangeEnd.getTime();

  return rows.reduce((sum, row) => {
    const paidAt = resolvePaidOrderDate(row);
    if (!paidAt) {
      return sum;
    }

    const paidTime = paidAt.getTime();
    if (paidTime < startTime || paidTime > endTime) {
      return sum;
    }

    return sum + toNumber(pickValue(row));
  }, 0);
}

function buildReportDateWhere(field, input = {}) {
  const startDate = parseDateOnly(input.startDate);
  const endDate = parseDateOnly(input.endDate);

  if (!startDate && !endDate) {
    return null;
  }

  const where = {};

  if (startDate) {
    where.gte = startOfDay(startDate);
  }

  if (endDate) {
    where.lte = endOfDay(endDate);
  }

  return {
    [field]: where,
  };
}

function buildPagination(total, page, pageSize) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function mapMemberStatus(status) {
  const labelMap = {
    ACTIVE: "有效",
    EXPIRED: "已过期",
    QUIT: "已退出",
    BANNED: "已封禁",
    PENDING: "审核中",
    REJECTED: "已驳回",
  };
  return labelMap[status] || status;
}

function mapPostStatus(status) {
  const labelMap = {
    DRAFT: "草稿",
    PUBLISHED: "已发布",
    HIDDEN: "已隐藏",
    DELETED: "已删除",
  };
  return labelMap[status] || status;
}

function mapPostType(type) {
  const labelMap = {
    TOPIC: "主题",
    ARTICLE: "文章",
    NOTICE: "公告",
    CHECKIN: "打卡",
    ASSIGNMENT: "作业",
  };
  return labelMap[type] || type;
}

function mapReviewStatus(status) {
  const labelMap = {
    APPROVED: "已通过",
    PENDING: "审核中",
    REJECTED: "已驳回",
  };
  return labelMap[status] || "未审核";
}

function parseMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...value };
}

function normalizeReviewStatusValue(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeReportStatusValue(value) {
  const status = String(value || "").trim().toUpperCase();
  if (status === "PENDING" || status === "RESOLVED" || status === "IGNORED" || status === "UNSET") {
    return status;
  }
  return "";
}

function mapReportStatus(status) {
  const labelMap = {
    PENDING: "待处理举报",
    RESOLVED: "已处理举报",
    IGNORED: "已忽略举报",
  };
  return labelMap[status] || "无举报";
}

function normalizeReportLog(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  if (!createdAt) {
    return null;
  }

  return {
    id: typeof value.id === "string" ? value.id : "",
    reporterUserId: typeof value.reporterUserId === "string" ? value.reporterUserId : "",
    reporterName: typeof value.reporterName === "string" ? value.reporterName : "",
    reason: typeof value.reason === "string" ? value.reason.trim() : "",
    status: normalizeReportStatusValue(value.status) || "PENDING",
    createdAt,
    resolvedAt: typeof value.resolvedAt === "string" ? value.resolvedAt : "",
    resolutionNote: typeof value.resolutionNote === "string" ? value.resolutionNote.trim() : "",
  };
}

function buildContentReportSnapshot(metadata) {
  const nextMetadata = parseMetadata(metadata);
  const reportLogs = Array.isArray(nextMetadata.reportLogs)
    ? nextMetadata.reportLogs.map(normalizeReportLog).filter(Boolean).slice(-20)
    : [];
  const latestLog = reportLogs.length ? reportLogs[reportLogs.length - 1] : null;
  let reportStatus = normalizeReportStatusValue(nextMetadata.reportStatus);
  let reportTotal = reportLogs.length;
  let reportPendingCount = reportLogs.filter((item) => item.status === "PENDING").length;
  let reportResolvedCount = reportLogs.filter((item) => item.status === "RESOLVED").length;
  let reportIgnoredCount = reportLogs.filter((item) => item.status === "IGNORED").length;
  let latestReportedAt = latestLog ? latestLog.createdAt : "";
  let latestReportReason = latestLog ? latestLog.reason : "";
  let reportResolutionNote =
    typeof nextMetadata.reportResolutionNote === "string"
      ? nextMetadata.reportResolutionNote.trim()
      : latestLog && latestLog.status !== "PENDING"
        ? latestLog.resolutionNote
        : "";

  if (!reportTotal) {
    reportTotal = toNumber(nextMetadata.reportCount);
    reportPendingCount = toNumber(nextMetadata.reportPendingCount);
    reportResolvedCount = toNumber(nextMetadata.reportResolvedCount);
    reportIgnoredCount = toNumber(nextMetadata.reportIgnoredCount);
    latestReportedAt = typeof nextMetadata.lastReportedAt === "string" ? nextMetadata.lastReportedAt : "";
    latestReportReason = typeof nextMetadata.lastReportedReason === "string" ? nextMetadata.lastReportedReason.trim() : "";
    if (!reportResolutionNote) {
      reportResolutionNote = typeof nextMetadata.reportResolutionNote === "string" ? nextMetadata.reportResolutionNote.trim() : "";
    }
  }

  if (!reportStatus) {
    if (reportPendingCount) {
      reportStatus = "PENDING";
    } else if (latestLog) {
      reportStatus = normalizeReportStatusValue(latestLog.status);
    }
  }

  if (reportStatus === "PENDING" && !reportPendingCount && latestLog) {
    reportStatus = normalizeReportStatusValue(latestLog.status);
  }

  return {
    reportLogs,
    reportStatus,
    reportTotal,
    reportPendingCount,
    reportResolvedCount,
    reportIgnoredCount,
    latestReportedAt,
    latestReportReason,
    reportResolutionNote,
  };
}

function applyContentReportSnapshot(metadata, snapshot) {
  metadata.reportLogs = snapshot.reportLogs;
  metadata.reportStatus = snapshot.reportStatus;
  metadata.reportCount = snapshot.reportTotal;
  metadata.reportPendingCount = snapshot.reportPendingCount;
  metadata.reportResolvedCount = snapshot.reportResolvedCount;
  metadata.reportIgnoredCount = snapshot.reportIgnoredCount;
  metadata.lastReportedAt = snapshot.latestReportedAt;
  metadata.lastReportedReason = snapshot.latestReportReason;
  metadata.reportResolutionNote = snapshot.reportResolutionNote;
  return metadata;
}

function buildAdminContentReportLogs(reportSnapshot) {
  return reportSnapshot.reportLogs.map((item, index) => ({
    id: item.id || `report_log_${index + 1}`,
    reporterUserId: item.reporterUserId || "",
    reporterName: item.reporterName || "匿名成员",
    reason: item.reason || "",
    status: item.status || "PENDING",
    statusLabel: mapReportStatus(item.status),
    createdAt: item.createdAt || "",
    resolvedAt: item.resolvedAt || "",
    resolutionNote: item.resolutionNote || "",
  }));
}

function hasUnsetReviewStatus(metadata) {
  const reviewStatus = normalizeReviewStatusValue(metadata && metadata.reviewStatus);
  return !reviewStatus || reviewStatus === "UNSET";
}

function hasUnsetReportStatus(metadata) {
  const reportStatus = normalizeReportStatusValue(metadata && metadata.reportStatus);
  return !reportStatus || reportStatus === "UNSET";
}

function matchesContentUnsetFilters(metadata, options = {}) {
  if (options.requiresUnsetReviewFilter && !hasUnsetReviewStatus(metadata)) {
    return false;
  }

  if (options.requiresUnsetReportFilter && !hasUnsetReportStatus(metadata)) {
    return false;
  }

  return true;
}

function buildAdminContentReportSummary(posts = []) {
  const summary = {
    reportPending: 0,
    reportResolved: 0,
    reportIgnored: 0,
    reportTotal: 0,
    latestReportedAt: "",
  };

  posts.forEach((post) => {
    const snapshot = buildContentReportSnapshot(parseMetadata(post.metadata));
    if (!snapshot.reportTotal) {
      return;
    }

    summary.reportTotal += 1;

    if (snapshot.reportStatus === "PENDING") {
      summary.reportPending += 1;
    } else if (snapshot.reportStatus === "RESOLVED") {
      summary.reportResolved += 1;
    } else if (snapshot.reportStatus === "IGNORED") {
      summary.reportIgnored += 1;
    }

    if (snapshot.latestReportedAt && (!summary.latestReportedAt || snapshot.latestReportedAt > summary.latestReportedAt)) {
      summary.latestReportedAt = snapshot.latestReportedAt;
    }
  });

  return summary;
}

function applyMetadataFilters(where, metadataFilters) {
  if (metadataFilters.length === 1) {
    where.metadata = metadataFilters[0];
    return;
  }

  if (metadataFilters.length > 1) {
    where.AND = metadataFilters.map((metadata) => ({ metadata }));
  }
}

async function buildColumnTitleMap(groupId, posts = []) {
  const columnIds = Array.from(
    new Set(
      posts
        .map((post) => String(parseMetadata(post.metadata).columnId || "").trim())
        .filter(Boolean)
    )
  );

  if (!columnIds.length) {
    return new Map();
  }

  const columns = await prisma.column.findMany({
    where: {
      groupId,
      id: {
        in: columnIds,
      },
    },
    select: {
      id: true,
      title: true,
    },
  });

  return new Map(columns.map((item) => [item.id, item.title]));
}

function resolvePostColumnTitle(metadata, columnTitleMap) {
  const columnId = String(metadata.columnId || "").trim();
  if (!columnId) {
    return "";
  }

  return String(metadata.columnTitle || columnTitleMap.get(columnId) || columnId);
}

function isImageAssetUrl(value) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(String(value || "").trim());
}

function extractAttachmentUrls(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .map((item) => {
      if (typeof item === "string") {
        return String(item || "").trim();
      }

      if (item && typeof item === "object" && typeof item.url === "string") {
        return item.url.trim();
      }

      return "";
    })
    .filter(Boolean);
}

function hasPostFileContent(post) {
  const metadata = parseMetadata(post.metadata);
  if (metadata.hasFile === true) {
    return true;
  }

  if (Array.isArray(metadata.fileAttachments) && metadata.fileAttachments.length > 0) {
    return true;
  }

  return extractAttachmentUrls(post.attachments).some((item) => !isImageAssetUrl(item));
}

function hasPostImageContent(post) {
  const metadata = parseMetadata(post.metadata);
  if (Array.isArray(metadata.images) && metadata.images.length > 0) {
    return true;
  }

  return extractAttachmentUrls(post.attachments).some((item) => isImageAssetUrl(item));
}

function buildFilteredContentSummary(posts = []) {
  const summary = {
    total: 0,
    published: 0,
    hidden: 0,
    draft: 0,
    deleted: 0,
    topicTotal: 0,
    article: 0,
    notice: 0,
    fileTotal: 0,
    imageTotal: 0,
    commentTotal: 0,
    likeTotal: 0,
    columnCount: 0,
  };
  const columnIds = new Set();

  posts.forEach((post) => {
    summary.total += 1;
    summary.topicTotal += 1;
    summary.commentTotal += toNumber(post.commentCount);
    summary.likeTotal += toNumber(post.likeCount);

    if (post.status === "PUBLISHED") {
      summary.published += 1;
    } else if (post.status === "HIDDEN") {
      summary.hidden += 1;
    } else if (post.status === "DRAFT") {
      summary.draft += 1;
    } else if (post.status === "DELETED") {
      summary.deleted += 1;
    }

    if (post.type === "ARTICLE") {
      summary.article += 1;
    } else if (post.type === "NOTICE") {
      summary.notice += 1;
    }

    if (hasPostFileContent(post)) {
      summary.fileTotal += 1;
    }

    if (hasPostImageContent(post)) {
      summary.imageTotal += 1;
    }

    const metadata = parseMetadata(post.metadata);
    const columnId = String(metadata.columnId || "").trim();
    if (columnId) {
      columnIds.add(columnId);
    }
  });

  summary.columnCount = columnIds.size;
  return summary;
}

function buildContentTrendFromPosts(posts = [], trendRange) {
  const trendMap = new Map();

  posts.forEach((post) => {
    const dateKey = buildDateKey(post.createdAt || post.publishedAt);
    if (!dateKey) {
      return;
    }

    const stat = trendMap.get(dateKey) || {
      topicCount: 0,
      fileCount: 0,
      imageCount: 0,
      commentCount: 0,
      likeCount: 0,
    };

    stat.topicCount += 1;
    if (hasPostFileContent(post)) {
      stat.fileCount += 1;
    }
    if (hasPostImageContent(post)) {
      stat.imageCount += 1;
    }
    stat.commentCount += toNumber(post.commentCount);
    stat.likeCount += toNumber(post.likeCount);
    trendMap.set(dateKey, stat);
  });

  const interactionTrend = [];
  let trendTopicCount = 0;
  let trendFileCount = 0;
  let trendImageCount = 0;
  let trendCommentCount = 0;
  let trendLikeCount = 0;

  for (let offset = 0; offset < trendRange.rangeDays; offset += 1) {
    const date = startOfDay(new Date(trendRange.startDate));
    date.setDate(trendRange.startDate.getDate() + offset);
    const dateKey = date.toISOString().slice(0, 10);
    const stat = trendMap.get(dateKey);
    const topicCount = stat ? stat.topicCount : 0;
    const fileCount = stat ? stat.fileCount : 0;
    const imageCount = stat ? stat.imageCount : 0;
    const commentCount = stat ? stat.commentCount : 0;
    const likeCount = stat ? stat.likeCount : 0;

    trendTopicCount += topicCount;
    trendFileCount += fileCount;
    trendImageCount += imageCount;
    trendCommentCount += commentCount;
    trendLikeCount += likeCount;

    interactionTrend.push({
      date: dateKey,
      label: formatStatDate(date),
      topicCount,
      fileCount,
      imageCount,
      commentCount,
      likeCount,
    });
  }

  return {
    interactionTrend,
    trendTopicCount,
    trendFileCount,
    trendImageCount,
    trendCommentCount,
    trendLikeCount,
  };
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeScoreboardRuleScore(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const rounded = Math.round(numeric * 10) / 10;
  if (rounded < 0 || rounded > 10) {
    return null;
  }

  return Number(rounded.toFixed(1));
}

function formatMoney(value) {
  return toNumber(value).toFixed(2);
}

function formatDateOnly(value) {
  return value ? toIso(value).slice(0, 10) : "";
}

function formatCount(value) {
  return String(Math.round(toNumber(value)));
}

function formatPercent(value) {
  return `${(toNumber(value) * 100).toFixed(2)}%`;
}

function formatRatio(numerator, denominator) {
  const base = toNumber(denominator);
  if (!base) {
    return "0.00%";
  }

  return `${((toNumber(numerator) / base) * 100).toFixed(2)}%`;
}

function buildDateKey(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function mapOrderType(type) {
  const labelMap = {
    GROUP_JOIN: "付费加入",
    GROUP_RENEWAL: "续期",
    REWARD: "赞赏",
    QUESTION: "付费提问",
    IDENTITY_MEMBER_MONTHLY: "身份会员月付",
    IDENTITY_MEMBER_QUARTERLY: "身份会员季付",
  };
  return labelMap[type] || type;
}

function mapOrderStatus(status, paymentStatus) {
  if (paymentStatus === "PAID") {
    return "已支付";
  }

  const labelMap = {
    PENDING: "待支付",
    CLOSED: "已关闭",
    REFUNDED: "已退款",
    FAILED: "已失败",
    PAID: "已支付",
  };
  return labelMap[status] || status;
}

function inferPromotionScene(channel) {
  const fingerprint = `${channel.name || ""} ${channel.code || ""}`.toLowerCase();
  if (fingerprint.includes("menu") || fingerprint.includes("菜单")) {
    return "内容导流";
  }
  if (fingerprint.includes("moments") || fingerprint.includes("朋友圈") || fingerprint.includes("poster")) {
    return "私域传播";
  }
  if (fingerprint.includes("live") || fingerprint.includes("直播")) {
    return "直播转化";
  }
  return "渠道投放";
}

function profileOf(user) {
  return user && user.profile ? user.profile : {};
}

function resolveUserDisplayName(user) {
  if (!user) {
    return "";
  }

  const profile = profileOf(user);
  return profile.nickname || user.mobile || "微信用户";
}

function normalizePromotionChannelName(value) {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validatePromotionChannelName(name) {
  if (!name) {
    return "请填写渠道名称";
  }

  if (name.length > 30) {
    return "渠道名称最多输入 30 个字符";
  }

  if (!PROMOTION_CHANNEL_NAME_PATTERN.test(name)) {
    return "渠道名称仅支持中文、英文、数字或空格";
  }

  return "";
}

function buildPromotionChannelCodeSlug(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 12);
}

async function generatePromotionChannelCode(name) {
  const slug = buildPromotionChannelCodeSlug(name) || "CHANNEL";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const timestampSuffix = Date.now().toString(36).toUpperCase();
    const code = `CH_${slug}_${timestampSuffix}${randomSuffix}`;
    const existing = await prisma.promotionChannel.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!existing) {
      return code;
    }
  }

  throw new Error("生成渠道码失败，请稍后重试");
}

function sanitizeMiniCodeFileSegment(value) {
  const normalizedValue = String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "_");
  return normalizedValue || "code";
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

function buildPromotionChannelMiniCodeScene(channelId) {
  const scene = `c=${String(channelId || "").trim()}`;

  if (scene.length > 32) {
    throw new Error("渠道标识过长，暂时无法生成小程序码");
  }

  return scene;
}

function findExistingPromotionChannelMiniCodeFile(channelId, envVersion) {
  const safeChannelId = sanitizeMiniCodeFileSegment(channelId);
  const targetDir = path.join(PROMOTION_CHANNEL_MINI_CODE_DIR, envVersion);
  const candidateExtensions = [".png", ".jpg", ".jpeg", ".webp"];

  for (let index = 0; index < candidateExtensions.length; index += 1) {
    const extension = candidateExtensions[index];
    const filePath = path.join(targetDir, `${safeChannelId}${extension}`);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile() && fs.statSync(filePath).size > 0) {
      return `/uploads/mini-program-codes/promotion-channel/${envVersion}/${safeChannelId}${extension}`;
    }
  }

  return "";
}

async function persistPromotionChannelMiniCodeUrl(channelId, qrCodeUrl) {
  if (!channelId || !qrCodeUrl) {
    return;
  }

  await prisma.promotionChannel.update({
    where: { id: channelId },
    data: {
      qrCodeUrl,
    },
  });
}

async function ensurePromotionChannelMiniCode(channel) {
  if (!channel || !channel.id) {
    return "";
  }

  const envVersion = getMiniProgramCodeEnvVersion();
  const existingFileUrl = findExistingPromotionChannelMiniCodeFile(channel.id, envVersion);
  if (existingFileUrl) {
    if (channel.qrCodeUrl !== existingFileUrl) {
      await persistPromotionChannelMiniCodeUrl(channel.id, existingFileUrl);
    }
    return existingFileUrl;
  }

  const generatedCode = await generateUnlimitedMiniProgramCode({
    page: PROMOTION_CHANNEL_MINI_CODE_PAGE,
    scene: buildPromotionChannelMiniCodeScene(channel.id),
    envVersion,
    width: 430,
  });

  const fileExtension = resolveMiniCodeFileExtension(generatedCode.contentType);
  const safeChannelId = sanitizeMiniCodeFileSegment(channel.id);
  const targetDir = path.join(PROMOTION_CHANNEL_MINI_CODE_DIR, envVersion);
  fs.mkdirSync(targetDir, { recursive: true });

  const savedPath = path.join(targetDir, `${safeChannelId}${fileExtension}`);
  fs.writeFileSync(savedPath, generatedCode.buffer);

  const fileUrl = `/uploads/mini-program-codes/promotion-channel/${envVersion}/${safeChannelId}${fileExtension}`;
  await persistPromotionChannelMiniCodeUrl(channel.id, fileUrl);
  return fileUrl;
}

function parsePromotionSceneRecord(scene) {
  const normalizedScene = String(scene || "").trim();
  if (!normalizedScene) {
    return {};
  }

  return normalizedScene.split("&").reduce((result, item) => {
    const [rawKey, ...rest] = String(item || "").split("=");
    const key = String(rawKey || "").trim();
    if (!key) {
      return result;
    }

    result[key] = rest.join("=").trim();
    return result;
  }, {});
}

async function resolvePromotionChannelScene(input = {}) {
  const rawScene = String(input.scene || "").trim();
  if (!rawScene) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少 scene 参数",
      },
    };
  }

  let decodedScene = rawScene;
  try {
    decodedScene = decodeURIComponent(rawScene);
  } catch (error) {
    decodedScene = rawScene;
  }

  const sceneRecord = parsePromotionSceneRecord(decodedScene);
  const channelId = String(sceneRecord.c || sceneRecord.channelId || "").trim();

  if (!channelId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "无效的渠道二维码参数",
      },
    };
  }

  const channel = await prisma.promotionChannel.findUnique({
    where: { id: channelId },
    include: {
      group: {
        include: {
          owner: {
            include: {
              profile: true,
            },
          },
        },
      },
    },
  });

  if (!channel || !channel.group) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "渠道不存在或已失效",
      },
    };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        groupId: channel.group.id,
        groupName: channel.group.name || "",
        ownerName: channel.group.owner && channel.group.owner.profile ? channel.group.owner.profile.nickname || "" : "",
        channelId: channel.id,
        channelCode: channel.code || "",
      },
    },
  };
}

function serializeAdminPromotionChannelRow(channel, group) {
  const paidOrders = channel.orders || [];
  const latestOrder = paidOrders[0] || null;
  const paidCount = paidOrders.length;
  const totalIncome = paidOrders.reduce((sum, order) => sum + toNumber(order.netAmount), 0);
  const visits = Math.max(paidCount * 6, paidCount ? paidCount : 0);
  const clicks = Math.max(paidCount * 2, paidCount ? paidCount : 0);

  return {
    id: channel.id,
    name: channel.name,
    code: channel.code,
    qrCodeUrl: channel.qrCodeUrl || "",
    createdAt: toIso(channel.createdAt),
    scene: inferPromotionScene(channel),
    status: channel.isEnabled ? "ACTIVE" : "PAUSED",
    statusLabel: channel.isEnabled ? "已启用" : "已停用",
    visits,
    clicks,
    paidCount,
    conversionRate: formatRatio(paidCount, visits),
    income: formatMoney(totalIncome),
    latestOrderNickname:
      latestOrder && latestOrder.user
        ? resolveUserDisplayName(latestOrder.user)
        : "",
    latestOrderNo: latestOrder ? latestOrder.orderNo : "",
    latestOrderPaidAt: latestOrder ? toIso(latestOrder.paidAt || latestOrder.createdAt) : "",
    creatorName: group && group.owner ? resolveUserDisplayName(group.owner) : "",
  };
}

function buildStaffRoleLabel(role) {
  const labelMap = {
    OWNER: "星主",
    PARTNER: "合伙人",
    ADMIN: "管理员",
    OPERATOR: "运营",
  };
  return labelMap[role] || "成员";
}

function resolveAdminRoleFromGuard(guard) {
  if (guard && guard.isOwner) {
    return "OWNER";
  }

  return guard && guard.staff && guard.staff.role ? String(guard.staff.role).trim().toUpperCase() : "UNKNOWN";
}

function resolveAdminPolicyCapability(policy, role, partnerKey, adminKey, defaultValue = true) {
  if (role === "OWNER") {
    return true;
  }

  if (role === "PARTNER") {
    return policy ? normalizeBoolean(policy[partnerKey], defaultValue) : defaultValue;
  }

  if (role === "ADMIN" || role === "OPERATOR") {
    return policy ? normalizeBoolean(policy[adminKey], defaultValue) : defaultValue;
  }

  return false;
}

function buildAdminViewer(guard) {
  if (guard && guard.isBoss) {
    return {
      userId: guard && guard.session ? guard.session.userId : "",
      role: "OWNER",
      roleLabel: "Boss",
      isOwner: true,
      capabilities: {
        canViewDashboard: true,
        canViewIncome: true,
        canViewMemberContact: true,
        canViewWeeklyReport: true,
        canManageMembers: true,
        canManageContent: true,
        canEditPermissions: true,
      },
    };
  }

  const role = resolveAdminRoleFromGuard(guard);
  const policy = guard && guard.group ? guard.group.permissionPolicy : null;
  const canViewDashboard = resolveAdminPolicyCapability(
    policy,
    role,
    "partnerCanViewDashboard",
    "adminCanViewDashboard",
    true
  );
  const canViewIncome = resolveAdminPolicyCapability(
    policy,
    role,
    "partnerCanViewIncome",
    "adminCanViewIncome",
    true
  );
  const canViewMemberContact = resolveAdminPolicyCapability(
    policy,
    role,
    "partnerCanViewMemberContact",
    "adminCanViewMemberContact",
    true
  );
  const canViewWeeklyReport = resolveAdminPolicyCapability(
    policy,
    role,
    "partnerCanViewWeeklyReport",
    "adminCanViewWeeklyReport",
    true
  );

  return {
    userId: guard && guard.session ? guard.session.userId : "",
    role,
    roleLabel: buildStaffRoleLabel(role),
    isOwner: Boolean(guard && guard.isOwner),
    capabilities: {
      canViewDashboard,
      canViewIncome,
      canViewMemberContact,
      canViewWeeklyReport,
      canManageMembers: role === "OWNER" || role === "PARTNER" || role === "ADMIN",
      canManageContent: role === "OWNER" || role === "PARTNER" || role === "ADMIN" || role === "OPERATOR",
      canEditPermissions: role === "OWNER",
    },
  };
}

function ensureAdminViewerCapability(guard, capabilityKey, deniedMessage) {
  const viewer = buildAdminViewer(guard);

  if (viewer.capabilities[capabilityKey]) {
    return { viewer };
  }

  return {
    viewer,
    error: {
      statusCode: 403,
      payload: {
        ok: false,
        message: deniedMessage,
      },
    },
  };
}

function buildRoleLabel(group, member, staffMap) {
  if (member.userId === group.ownerUserId) {
    return buildStaffRoleLabel("OWNER");
  }

  const staff = staffMap.get(member.userId);
  if (!staff) {
    return "成员";
  }

  return buildStaffRoleLabel(staff.role);
}

function buildAdminMemberRemoveState(group, member, staffMap) {
  if (!member || !group) {
    return {
      canRemove: false,
      removeDisabledReason: "成员信息不完整，暂时不能踢出",
    };
  }

  if (member.userId === group.ownerUserId) {
    return {
      canRemove: false,
      removeDisabledReason: "星主不能被踢出",
    };
  }

  if (staffMap.get(member.userId)) {
    return {
      canRemove: false,
      removeDisabledReason: "请先移除该成员的后台身份后再踢出",
    };
  }

  if (member.status === "QUIT") {
    return {
      canRemove: false,
      removeDisabledReason: "该成员已退出星球",
    };
  }

  return {
    canRemove: true,
    removeDisabledReason: "",
  };
}

function isJoinApplicationStatus(status) {
  return status === "PENDING" || status === "REJECTED";
}

function normalizeAdminMemberSourceType(value) {
  const sourceType = String(value || "").trim().toUpperCase();
  if (sourceType === "APPLICATION" || sourceType === "MEMBER") {
    return sourceType;
  }
  return "ALL";
}

function buildAdminMemberRow(group, member, staffMap, topicCountMap, now) {
  const profile = profileOf(member.user);
  const expireTime = member.expireAt ? new Date(member.expireAt).getTime() : null;
  const removeState = buildAdminMemberRemoveState(group, member, staffMap);
  return {
    id: member.id,
    userId: member.userId,
    memberNo: member.memberNo,
    nickname: profile.nickname || "微信用户",
    avatarUrl: profile.avatarUrl || "",
    mobile: member.user && member.user.mobile ? member.user.mobile : "",
    phone: member.phone || "",
    wechatNo: member.wechatNo || profile.wechatNo || "",
    remark: profile.remark || "",
    roleLabel: buildRoleLabel(group, member, staffMap),
    status: member.status,
    statusLabel: mapMemberStatus(member.status),
    approvalStatus: "",
    approvalStatusLabel: "",
    sourceType: "MEMBER",
    orderNo: "",
    reviewReason: "",
    reviewedAt: "",
    appliedAt: "",
    lastReappliedAt: "",
    reapplyCount: 0,
    isPaid: Boolean(member.isPaid),
    joinSource: member.joinSource,
    joinedAt: toIso(member.joinedAt),
    firstJoinedAt: toIso(member.firstJoinedAt || member.joinedAt),
    expireAt: toIso(member.expireAt),
    lastActiveAt: toIso(member.lastActiveAt),
    renewTimes: member.renewTimes,
    topicCount: topicCountMap.get(member.userId) || 0,
    isExpiringSoon:
      member.status === "ACTIVE" &&
      expireTime !== null &&
      expireTime > now &&
      expireTime - now <= 30 * 24 * 60 * 60 * 1000,
    canRemove: removeState.canRemove,
    removeDisabledReason: removeState.removeDisabledReason,
    canApprove: false,
    canReject: false,
  };
}

function buildAdminJoinApplicationRow(group, application, staffMap, topicCountMap) {
  const profile = profileOf(application.order.user);
  const reviewMeta = parseJoinApplicationReviewMeta(application.payment);
  const appliedAt = reviewMeta.reviewSubmittedAt || application.order.paidAt || application.order.createdAt;
  const joinSource = application.order.promotionChannelId ? "QR_CODE" : "DIRECT";
  return {
    id: `application_${application.order.orderNo}`,
    userId: application.order.userId,
    memberNo: null,
    nickname: profile.nickname || "微信用户",
    avatarUrl: profile.avatarUrl || "",
    mobile: application.order.user && application.order.user.mobile ? application.order.user.mobile : "",
    phone: "",
    wechatNo: profile.wechatNo || "",
    remark: profile.remark || "",
    roleLabel: buildRoleLabel(group, { userId: application.order.userId }, staffMap),
    status: application.reviewStatus,
    statusLabel: mapMemberStatus(application.reviewStatus),
    approvalStatus: application.reviewStatus,
    approvalStatusLabel: mapMemberStatus(application.reviewStatus),
    sourceType: "APPLICATION",
    orderNo: application.order.orderNo,
    reviewReason: application.reviewReason || "",
    reviewedAt: toIso(application.reviewedAt),
    appliedAt: toIso(appliedAt),
    lastReappliedAt: toIso(reviewMeta.lastReappliedAt),
    reapplyCount: reviewMeta.reapplyCount,
    isPaid: true,
    joinSource,
    joinedAt: toIso(appliedAt),
    firstJoinedAt: toIso(appliedAt),
    expireAt: "",
    lastActiveAt: "",
    renewTimes: 0,
    topicCount: topicCountMap.get(application.order.userId) || 0,
    isExpiringSoon: false,
    canRemove: false,
    removeDisabledReason: "申请记录不能执行踢出",
    canApprove: true,
    canReject: true,
  };
}

function filterAdminMemberRowsBySearch(items, search, options = {}) {
  if (!search) {
    return items;
  }

  const includeContactFields = options.includeContactFields !== false;
  const normalizedSearch = search.toLowerCase();
  return items.filter((item) => {
    const candidates = [item.nickname, item.orderNo, item.reviewReason];

    if (includeContactFields) {
      candidates.push(item.mobile, item.phone, item.wechatNo);
    }

    return candidates.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  });
}

function applyAdminMemberContactVisibility(items, canViewMemberContact) {
  if (canViewMemberContact) {
    return items;
  }

  return items.map((item) => ({
    ...item,
    mobile: "",
    phone: "",
    wechatNo: "",
  }));
}

function filterAdminMemberRowsByDate(items, input) {
  const startDate = parseDateOnly(input.startDate);
  const endDate = parseDateOnly(input.endDate);
  if (!startDate && !endDate) {
    return items;
  }

  const startTime = startDate ? startOfDay(startDate).getTime() : Number.NEGATIVE_INFINITY;
  const endTime = endDate ? endOfDay(endDate).getTime() : Number.POSITIVE_INFINITY;

  return items.filter((item) => {
    const compareValue = item.appliedAt || item.joinedAt || item.firstJoinedAt;
    const compareTime = compareValue ? new Date(compareValue).getTime() : Number.NaN;
    return Number.isFinite(compareTime) && compareTime >= startTime && compareTime <= endTime;
  });
}

function getAdminMemberRowSortRank(item) {
  const rankMap = {
    PENDING: 0,
    REJECTED: 1,
    ACTIVE: 2,
    EXPIRED: 3,
    BANNED: 4,
    QUIT: 5,
  };
  return rankMap[item.status] === undefined ? 99 : rankMap[item.status];
}

function getAdminMemberRowTime(item) {
  return new Date(item.appliedAt || item.reviewedAt || item.joinedAt || item.firstJoinedAt || 0).getTime();
}

function compareAdminMemberRows(left, right) {
  const rankDiff = getAdminMemberRowSortRank(left) - getAdminMemberRowSortRank(right);
  if (rankDiff !== 0) {
    return rankDiff;
  }

  const leftIsApplication = left.sourceType === "APPLICATION";
  const rightIsApplication = right.sourceType === "APPLICATION";

  if (leftIsApplication && rightIsApplication && left.status === right.status) {
    const reapplyDiff = toNumber(right.reapplyCount) - toNumber(left.reapplyCount);
    if (reapplyDiff !== 0) {
      return reapplyDiff;
    }

    const leftTime = getAdminMemberRowTime(left);
    const rightTime = getAdminMemberRowTime(right);

    if (left.status === "PENDING" && leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }
  } else {
    const leftTime = getAdminMemberRowTime(left);
    const rightTime = getAdminMemberRowTime(right);
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }
  }

  return String(left.nickname || "").localeCompare(String(right.nickname || ""), "zh-CN");
}

function parseJoinApplicationReviewMeta(payment) {
  const rawPayload =
    payment && payment.rawPayload && typeof payment.rawPayload === "object" && !Array.isArray(payment.rawPayload)
      ? payment.rawPayload
      : {};
  const reapplyCount = Number(rawPayload.reapplyCount);

  return {
    reviewSubmittedAt: rawPayload.reviewSubmittedAt || null,
    lastReappliedAt: rawPayload.lastReappliedAt || null,
    reapplyCount: Number.isFinite(reapplyCount) && reapplyCount > 0 ? Math.floor(reapplyCount) : 0,
  };
}

function buildAdminApplicationQueueSummary(reviewApplications) {
  const summary = {
    latestSubmittedAt: "",
    oldestPendingSubmittedAt: "",
    latestReappliedAt: "",
  };

  let latestSubmittedTime = 0;
  let oldestPendingTime = Number.POSITIVE_INFINITY;
  let latestReappliedTime = 0;

  for (const item of reviewApplications) {
    const reviewMeta = parseJoinApplicationReviewMeta(item.payment);
    const submittedAt = new Date(reviewMeta.reviewSubmittedAt || item.order.paidAt || item.order.createdAt || 0).getTime();
    if (Number.isFinite(submittedAt) && submittedAt > latestSubmittedTime) {
      latestSubmittedTime = submittedAt;
    }

    if (item.reviewStatus === "PENDING" && Number.isFinite(submittedAt) && submittedAt < oldestPendingTime) {
      oldestPendingTime = submittedAt;
    }

    const lastReappliedTime = new Date(reviewMeta.lastReappliedAt || 0).getTime();
    if (Number.isFinite(lastReappliedTime) && lastReappliedTime > latestReappliedTime) {
      latestReappliedTime = lastReappliedTime;
    }
  }

  if (latestSubmittedTime > 0) {
    summary.latestSubmittedAt = new Date(latestSubmittedTime).toISOString();
  }

  if (Number.isFinite(oldestPendingTime) && oldestPendingTime !== Number.POSITIVE_INFINITY) {
    summary.oldestPendingSubmittedAt = new Date(oldestPendingTime).toISOString();
  }

  if (latestReappliedTime > 0) {
    summary.latestReappliedAt = new Date(latestReappliedTime).toISOString();
  }

  return summary;
}

async function getActiveSession(sessionToken) {
  if (!sessionToken) {
    return null;
  }

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

  if (!session || session.status !== "ACTIVE" || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return session;
}

async function resolveGroup(groupId) {
  if (groupId) {
    return prisma.group.findUnique({
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
  }

  return prisma.group.findFirst({
    where: { status: { in: ["ACTIVE", "HIDDEN"] } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: {
      owner: {
        include: {
          profile: true,
        },
      },
      permissionPolicy: true,
    },
  });
}

async function ensureGroupManager(groupId, sessionToken) {
  const session = await getActiveSession(sessionToken);
  if (!session) {
    return {
      error: { statusCode: 401, payload: { ok: false, message: "请先登录后台后再操作" } },
    };
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      permissionPolicy: true,
      owner: {
        include: {
          profile: true,
        },
      },
    },
  });

  if (!group) {
    return {
      error: { statusCode: 404, payload: { ok: false, message: "星球不存在" } },
    };
  }

  if (isWebBossSession(session)) {
    return {
      group,
      session,
      staff: null,
      isOwner: true,
      isBoss: true,
    };
  }

  const staff = await prisma.groupStaff.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: session.userId,
      },
    },
  });

  const isOwner = group.ownerUserId === session.userId;
  const isStaff = Boolean(staff && staff.isActive);

  if (!isOwner && !isStaff) {
    return {
      error: { statusCode: 403, payload: { ok: false, message: "暂无权限访问当前星球后台" } },
    };
  }

  return {
    group,
    session,
    staff,
    isOwner,
  };
}

async function authorizeAdminGroupAccess(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        groupId: guard.group.id,
        userId: guard.session.userId,
        isOwner: guard.isOwner,
        role: guard.isOwner ? "OWNER" : guard.staff ? guard.staff.role : "UNKNOWN",
      },
    },
  };
}

async function authorizeWebBossAccess(input = {}) {
  const sessionToken = String(input.sessionToken || "").trim();
  if (!sessionToken) {
    return {
      statusCode: 401,
      payload: {
        ok: false,
        message: "请先登录后台后再操作",
      },
    };
  }

  const session = await getActiveSession(sessionToken);
  if (!session) {
    return {
      statusCode: 401,
      payload: {
        ok: false,
        message: "登录态已失效，请重新登录",
      },
    };
  }

  if (!isWebBossSession(session)) {
    return {
      statusCode: 403,
      payload: {
        ok: false,
        message: "课程后台是独立后台功能，当前仅 Boss 账号可管理",
      },
    };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        userId: session.userId,
        role: "BOSS",
      },
    },
  };
}

async function ensureAdminGroupContext(input = {}) {
  const groupId = String(input.groupId || "").trim();
  if (!groupId) {
    return {
      error: {
        statusCode: 400,
        payload: {
          ok: false,
          message: "缺少星球ID",
        },
      },
    };
  }

  const sessionToken = String(input.sessionToken || "").trim();
  if (!sessionToken) {
    return {
      error: {
        statusCode: 401,
        payload: {
          ok: false,
          message: "请先登录后台后再操作",
        },
      },
    };
  }

  const guard = await ensureGroupManager(groupId, sessionToken);
  if (guard.error) {
    return guard;
  }

  return guard;
}

async function getAdminManageableGroups(input = {}) {
  const manageableStatuses = ["ACTIVE", "HIDDEN", "DRAFT"];
  const sessionToken = String(input.sessionToken || "").trim();
  if (!sessionToken) {
    return {
      statusCode: 401,
      payload: {
        ok: false,
        message: "请先登录后台后再操作",
      },
    };
  }

  const session = await getActiveSession(sessionToken);
  if (!session) {
    return {
      statusCode: 401,
      payload: {
        ok: false,
        message: "登录态已失效，请重新登录",
      },
    };
  }

  if (isWebBossSession(session)) {
    const groups = await prisma.group.findMany({
      where: {
        status: {
          in: manageableStatuses,
        },
      },
      include: {
        owner: {
          include: {
            profile: true,
          },
        },
        permissionPolicy: true,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });

    const bossGroups = groups.map((group) => ({
      id: group.id,
      name: group.name,
      slug: group.slug,
      ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
      memberCount: group.memberCount,
      role: "OWNER",
      roleLabel: "Boss",
      isOwner: true,
      status: group.status,
      createdAt: toIso(group.createdAt),
      publishedAt: toIso(group.publishedAt),
      capabilities: {
        canViewDashboard: true,
        canViewIncome: true,
        canViewMemberContact: true,
        canViewWeeklyReport: true,
        canManageMembers: true,
        canManageContent: true,
        canEditPermissions: true,
      },
    }));

    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          groups: bossGroups,
          total: bossGroups.length,
          defaultGroupId: bossGroups[0] ? bossGroups[0].id : "",
        },
      },
    };
  }

  const [ownedGroups, staffRows] = await Promise.all([
    prisma.group.findMany({
      where: {
        ownerUserId: session.userId,
        status: {
          in: manageableStatuses,
        },
      },
      include: {
        owner: {
          include: {
            profile: true,
          },
        },
        permissionPolicy: true,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.groupStaff.findMany({
      where: {
        userId: session.userId,
        isActive: true,
        group: {
          status: {
            in: manageableStatuses,
          },
        },
      },
      include: {
        group: {
          include: {
            owner: {
              include: {
                profile: true,
              },
            },
            permissionPolicy: true,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  const groupMap = new Map();

  ownedGroups.forEach((group) => {
    const viewer = buildAdminViewer({
      group,
      session,
      staff: null,
      isOwner: true,
    });

    groupMap.set(group.id, {
      id: group.id,
      name: group.name,
      slug: group.slug,
      ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
      memberCount: group.memberCount,
      role: "OWNER",
      roleLabel: buildStaffRoleLabel("OWNER"),
      isOwner: true,
      status: group.status,
      createdAt: toIso(group.createdAt),
      publishedAt: toIso(group.publishedAt),
      capabilities: viewer.capabilities,
    });
  });

  staffRows.forEach((staff) => {
    if (!staff.group || groupMap.has(staff.group.id)) {
      return;
    }

    const viewer = buildAdminViewer({
      group: staff.group,
      session,
      staff,
      isOwner: false,
    });

    groupMap.set(staff.group.id, {
      id: staff.group.id,
      name: staff.group.name,
      slug: staff.group.slug,
      ownerName: staff.group.owner && staff.group.owner.profile ? staff.group.owner.profile.nickname : "星主",
      memberCount: staff.group.memberCount,
      role: staff.role,
      roleLabel: buildStaffRoleLabel(staff.role),
      isOwner: false,
      status: staff.group.status,
      createdAt: toIso(staff.group.createdAt),
      publishedAt: toIso(staff.group.publishedAt),
      capabilities: viewer.capabilities,
    });
  });

  const rolePriority = {
    OWNER: 0,
    PARTNER: 1,
    ADMIN: 2,
    OPERATOR: 3,
  };

  const groups = Array.from(groupMap.values()).sort((left, right) => {
    const roleDiff = (rolePriority[left.role] ?? 99) - (rolePriority[right.role] ?? 99);
    if (roleDiff !== 0) {
      return roleDiff;
    }

    const rightTime = new Date(right.publishedAt || right.createdAt || 0).getTime();
    const leftTime = new Date(left.publishedAt || left.createdAt || 0).getTime();
    return rightTime - leftTime;
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        groups,
        total: groups.length,
        defaultGroupId: groups[0] ? groups[0].id : "",
      },
    },
  };
}

function formatDateTimeForDisplay(value) {
  if (!value) {
    return "";
  }

  return toIso(value).slice(0, 16).replace("T", " ");
}

function formatDateForDisplay(value) {
  if (!value) {
    return "";
  }

  return toIso(value).slice(0, 10);
}

function escapeCsvCell(value) {
  const normalized = value === null || value === undefined ? "" : String(value);
  if (!/[",\r\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, '""')}"`;
}

function buildCsvContent(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}`;
}

function buildExportFileName(prefix, group) {
  const slug = String((group && (group.slug || group.id)) || "group").replace(/[^\w-]+/g, "-");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
  return `${prefix}_${slug}_${stamp}.csv`;
}

async function recordExportTask(input) {
  try {
    await prisma.exportTask.create({
      data: {
        groupId: input.groupId,
        type: input.type,
        status: "SUCCESS",
        fileName: input.fileName,
        beginTime: input.beginTime || null,
        endTime: input.endTime || null,
        onlyValidMembers: input.onlyValidMembers === undefined ? null : Boolean(input.onlyValidMembers),
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    console.warn("[admin-export] failed to record export task", error);
  }
}

function buildChannelLiveCurrentMemberWhere(groupId) {
  return {
    groupId,
    status: {
      in: ["ACTIVE", "EXPIRED"],
    },
  };
}

function buildChannelLiveValidMemberWhere(groupId) {
  return {
    groupId,
    status: "ACTIVE",
    OR: [
      { expireAt: null },
      { expireAt: { gt: new Date() } },
    ],
  };
}

async function getAdminChannelLiveSummary(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }

  const group = guard.group;
  const currentMemberWhere = buildChannelLiveCurrentMemberWhere(group.id);
  const validMemberWhere = buildChannelLiveValidMemberWhere(group.id);

  const [
    currentMemberCount,
    validMemberCount,
    exportableAllMemberCount,
    exportableValidMemberCount,
    lastExportTask,
  ] = await Promise.all([
    prisma.groupMember.count({
      where: currentMemberWhere,
    }),
    prisma.groupMember.count({
      where: validMemberWhere,
    }),
    prisma.groupMember.count({
      where: {
        ...currentMemberWhere,
        user: {
          openId: {
            not: null,
          },
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        ...validMemberWhere,
        user: {
          openId: {
            not: null,
          },
        },
      },
    }),
    prisma.exportTask.findFirst({
      where: {
        groupId: group.id,
        type: "VIDEO_LIVE_MEMBER_LIST",
        status: "SUCCESS",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
        fileName: true,
        onlyValidMembers: true,
      },
    }),
  ]);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner?.profile?.nickname || "未命名星主",
        },
        summary: {
          currentMemberCount,
          validMemberCount,
          exportableAllMemberCount,
          exportableValidMemberCount,
          missingOpenIdAllCount: Math.max(currentMemberCount - exportableAllMemberCount, 0),
          missingOpenIdValidCount: Math.max(validMemberCount - exportableValidMemberCount, 0),
          lastExportedAt: toIso(lastExportTask?.createdAt),
          lastExportFileName: lastExportTask?.fileName || "",
          lastExportOnlyValidMembers:
            typeof lastExportTask?.onlyValidMembers === "boolean" ? lastExportTask.onlyValidMembers : null,
        },
      },
    },
  };
}

async function exportAdminChannelLiveMembers(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }

  const group = guard.group;
  const onlyValidMembers = parseBooleanFlag(input.onlyValidMembers, true);
  const memberWhere = onlyValidMembers
    ? buildChannelLiveValidMemberWhere(group.id)
    : buildChannelLiveCurrentMemberWhere(group.id);

  const rows = await prisma.groupMember.findMany({
    where: memberWhere,
    include: {
      user: {
        select: {
          openId: true,
        },
      },
    },
    orderBy: [{ expireAt: "asc" }, { joinedAt: "desc" }, { memberNo: "asc" }],
  });

  const exportRows = rows.filter((item) => item.user && item.user.openId);
  if (!exportRows.length) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: onlyValidMembers ? "当前没有可导出的有效成员 OpenID" : "当前没有可导出的成员 OpenID",
      },
    };
  }

  const csvContent = buildCsvContent(
    ["OpenID"],
    exportRows.map((item) => [item.user.openId])
  );

  const fileName = buildExportFileName(
    onlyValidMembers ? "video-live-member-list-valid" : "video-live-member-list-all",
    group
  );

  await recordExportTask({
    groupId: group.id,
    type: "VIDEO_LIVE_MEMBER_LIST",
    fileName,
    onlyValidMembers,
  });

  return {
    statusCode: 200,
    payload: csvContent,
    contentType: "text/csv; charset=utf-8",
    fileName,
  };
}

async function getAdminMembers(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;
  const viewerAccess = ensureAdminViewerCapability(guard, "canViewDashboard", "当前角色未开启成员后台查看权限");
  if (viewerAccess.error) {
    return viewerAccess.error;
  }
  const viewer = viewerAccess.viewer;

  const page = parsePositiveInt(input.page, 1, 9999);
  const pageSize = parsePositiveInt(input.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const status = String(input.status || "").trim().toUpperCase() || "ALL";
  const sourceType = normalizeAdminMemberSourceType(input.sourceType);
  const search = String(input.search || "").trim();
  const reportDateWhere = buildReportDateWhere("joinedAt", input);
  const trendRange = buildTrendRange(input);
  const todayStart = startOfDay(new Date());
  const yesterdayStart = startOfDay(new Date(todayStart));
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = endOfDay(new Date(yesterdayStart));
  const monthActiveSince = startOfDay(new Date(todayStart));
  monthActiveSince.setDate(monthActiveSince.getDate() - 29);
  const shouldLoadMembers = sourceType !== "APPLICATION" && (status === "ALL" || !isJoinApplicationStatus(status));
  const shouldLoadApplications = sourceType !== "MEMBER" && (status === "ALL" || isJoinApplicationStatus(status));

  const memberWhere = {
    groupId: group.id,
  };

  if (shouldLoadMembers && status !== "ALL" && !isJoinApplicationStatus(status)) {
    memberWhere.status = status;
  }

  if (shouldLoadMembers && search) {
    memberWhere.OR = [{ user: { profile: { nickname: { contains: search, mode: "insensitive" } } } }];

    if (viewer.capabilities.canViewMemberContact) {
      memberWhere.OR.unshift(
        { phone: { contains: search } },
        { wechatNo: { contains: search } },
        { user: { mobile: { contains: search } } }
      );
    }
  }

  if (shouldLoadMembers && reportDateWhere) {
    Object.assign(memberWhere, reportDateWhere);
  }

  const [
    rows,
    statusGroups,
    staffs,
    latestMemberStat,
    trendRows,
    totalJoinedYesterday,
    paidJoinedYesterday,
    freeJoinedYesterday,
    quitYesterday,
    currentPaidCount,
    currentFreeCount,
    monthActiveCount,
    validMonthActiveCount,
    expiredMonthActiveCount,
    reviewApplications,
  ] = await Promise.all([
    shouldLoadMembers
      ? prisma.groupMember.findMany({
          where: memberWhere,
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
          orderBy: [{ status: "asc" }, { joinedAt: "desc" }, { memberNo: "asc" }],
        })
      : Promise.resolve([]),
    prisma.groupMember.groupBy({
      by: ["status"],
      where: { groupId: group.id },
      _count: { _all: true },
    }),
    prisma.groupStaff.findMany({
      where: {
        groupId: group.id,
        isActive: true,
      },
      select: {
        userId: true,
        role: true,
      },
    }),
    prisma.groupMemberDailyStat.findFirst({
      where: {
        groupId: group.id,
      },
      orderBy: {
        statDate: "desc",
      },
    }),
    prisma.groupMemberDailyStat.findMany({
      where: {
        groupId: group.id,
        statDate: {
          gte: trendRange.startDate,
          lte: trendRange.endDate,
        },
      },
      orderBy: {
        statDate: "asc",
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        joinedAt: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        isPaid: true,
        joinedAt: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        isPaid: false,
        joinedAt: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        status: "QUIT",
        updatedAt: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        isPaid: true,
        status: {
          not: "QUIT",
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        isPaid: false,
        status: {
          not: "QUIT",
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        status: {
          in: ["ACTIVE", "EXPIRED"],
        },
        lastActiveAt: {
          gte: monthActiveSince,
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        status: "ACTIVE",
        lastActiveAt: {
          gte: monthActiveSince,
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        status: "EXPIRED",
        lastActiveAt: {
          gte: monthActiveSince,
        },
      },
    }),
    shouldLoadApplications ? listGroupJoinReviewApplications(group.id) : Promise.resolve([]),
  ]);

  const filteredReviewApplications = reviewApplications.filter((item) => {
    if (status === "PENDING") {
      return item.reviewStatus === "PENDING";
    }

    if (status === "REJECTED") {
      return item.reviewStatus === "REJECTED";
    }

    return true;
  });

  const topicGroups = await prisma.post.groupBy({
    by: ["authorUserId"],
    where: {
      groupId: group.id,
      status: {
        not: "DELETED",
      },
      authorUserId: {
        in:
          rows.length || filteredReviewApplications.length
            ? Array.from(
                new Set(
                  rows.map((member) => member.userId).concat(filteredReviewApplications.map((item) => item.order.userId))
                )
              )
            : ["__never__"],
      },
    },
    _count: {
      _all: true,
    },
  });

  const topicCountMap = new Map(topicGroups.map((item) => [item.authorUserId, item._count._all]));
  const staffMap = new Map(staffs.map((staff) => [staff.userId, staff]));
  const summaryMap = statusGroups.reduce((acc, item) => {
    acc[item.status] = item._count._all;
    return acc;
  }, {});
  const reviewSummaryMap = reviewApplications.reduce(
    (acc, item) => {
      acc[item.reviewStatus] = (acc[item.reviewStatus] || 0) + 1;
      acc.total += 1;
      const reviewMeta = parseJoinApplicationReviewMeta(item.payment);
      if (reviewMeta.reapplyCount > 0) {
        acc.reapplied += 1;
        if (item.reviewStatus === "PENDING") {
          acc.urgentPending += 1;
        }
      }
      return acc;
    },
    { PENDING: 0, REJECTED: 0, total: 0, reapplied: 0, urgentPending: 0 }
  );
  const applicationQueueSummary = buildAdminApplicationQueueSummary(reviewApplications);
  const paidCurrent = latestMemberStat ? latestMemberStat.paidMemberCount : currentPaidCount;
  const freeCurrent = latestMemberStat ? latestMemberStat.freeMemberCount : currentFreeCount;
  const totalCurrent = latestMemberStat ? latestMemberStat.totalMemberCount : paidCurrent + freeCurrent;
  const quitTotal = latestMemberStat
    ? Math.max(latestMemberStat.quittedCount, summaryMap.QUIT || 0)
    : summaryMap.QUIT || 0;
  const weeklyActiveCount = latestMemberStat ? latestMemberStat.activeMemberCount7d : 0;
  const weeklyActiveRate = latestMemberStat ? Number(latestMemberStat.weeklyActiveRate) : 0;
  const downloadedCount = latestMemberStat ? latestMemberStat.appDownloadedCount : 0;
  const downloadRate = latestMemberStat ? Number(latestMemberStat.appDownloadRate) : 0;

  const trendMap = new Map(
    trendRows.map((item) => [new Date(item.statDate).toISOString().slice(0, 10), item])
  );
  const trend = [];
  for (let offset = 0; offset < trendRange.rangeDays; offset += 1) {
    const date = startOfDay(new Date(trendRange.startDate));
    date.setDate(trendRange.startDate.getDate() + offset);
    const dateKey = date.toISOString().slice(0, 10);
    const stat = trendMap.get(dateKey);
    trend.push({
      date: dateKey,
      label: formatStatDate(date),
      totalMemberCount: stat ? stat.totalMemberCount : 0,
      activeMemberCount7d: stat ? stat.activeMemberCount7d : 0,
      appDownloadedCount: stat ? stat.appDownloadedCount : 0,
      weeklyActiveRate: stat ? Number(stat.weeklyActiveRate) : 0,
      appDownloadRate: stat ? Number(stat.appDownloadRate) : 0,
    });
  }

  const now = Date.now();
  const memberItems = rows.map((member) => buildAdminMemberRow(group, member, staffMap, topicCountMap, now));
  const applicationItems = filterAdminMemberRowsByDate(
    filterAdminMemberRowsBySearch(
      filteredReviewApplications.map((item) => buildAdminJoinApplicationRow(group, item, staffMap, topicCountMap)),
      search,
      {
        includeContactFields: viewer.capabilities.canViewMemberContact,
      }
    ),
    input
  );
  const combinedItems = [];
  if (shouldLoadApplications) {
    combinedItems.push(...applicationItems);
  }
  if (shouldLoadMembers) {
    combinedItems.push(...memberItems);
  }
  const sortedItems = applyAdminMemberContactVisibility(
    [...combinedItems].sort(compareAdminMemberRows),
    viewer.capabilities.canViewMemberContact
  );
  const total = sortedItems.length;
  const pagedItems = sortedItems.slice((page - 1) * pageSize, page * pageSize);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
        },
        viewer,
        filters: {
          status,
          sourceType,
          search,
          startDate: String(input.startDate || ""),
          endDate: String(input.endDate || ""),
          rangeDays: trendRange.rangeDays,
        },
        summary: {
          total: totalCurrent,
          active: summaryMap.ACTIVE || 0,
          expired: summaryMap.EXPIRED || 0,
          banned: summaryMap.BANNED || 0,
          quit: quitTotal,
          paid: paidCurrent,
          pendingApproval: reviewSummaryMap.PENDING || 0,
          rejectedApproval: reviewSummaryMap.REJECTED || 0,
          applicationTotal: reviewSummaryMap.total || 0,
          reappliedApproval: reviewSummaryMap.reapplied || 0,
          urgentPendingApproval: reviewSummaryMap.urgentPending || 0,
          latestApplicationSubmittedAt: applicationQueueSummary.latestSubmittedAt,
          oldestPendingApplicationAt: applicationQueueSummary.oldestPendingSubmittedAt,
          latestReappliedAt: applicationQueueSummary.latestReappliedAt,
          weeklyActiveCount,
          weeklyActiveRate,
          appDownloadedCount: downloadedCount,
          appDownloadRate: downloadRate,
          overview: {
            totalCurrent,
            totalJoinedYesterday,
            paidCurrent,
            paidJoinedYesterday,
            freeCurrent,
            freeJoinedYesterday,
            quitTotal,
            quitYesterday,
          },
          activity: {
            totalCurrent,
            weeklyActiveCount,
            weeklyActiveRate,
            monthActiveCount,
            validMonthActiveCount,
            expiredMonthActiveCount,
            appDownloadedCount: downloadedCount,
            appDownloadRate: downloadRate,
          },
        },
        trend,
        pagination: buildPagination(total, page, pageSize),
        items: pagedItems,
      },
    },
  };
}

async function getAdminContent(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;
  const viewerAccess = ensureAdminViewerCapability(guard, "canViewDashboard", "当前角色未开启内容后台查看权限");
  if (viewerAccess.error) {
    return viewerAccess.error;
  }
  const viewer = viewerAccess.viewer;

  const page = parsePositiveInt(input.page, 1, 9999);
  const pageSize = parsePositiveInt(input.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const status = String(input.status || "").trim().toUpperCase() || "ALL";
  const type = String(input.type || "").trim().toUpperCase() || "ALL";
  const reviewStatus = String(input.reviewStatus || "").trim().toUpperCase() || "ALL";
  const reportStatus = normalizeReportStatusValue(input.reportStatus) || "ALL";
  const requiresUnsetReviewFilter = reviewStatus === "UNSET";
  const requiresUnsetReportFilter = reportStatus === "UNSET";
  const columnId = String(input.columnId || "").trim();
  const search = String(input.search || "").trim();
  const reportDateWhere = buildReportDateWhere("createdAt", input);
  const trendRange = buildTrendRange(input);
  const contentTrendFiltersApplied = Boolean(
    status !== "ALL" || type !== "ALL" || reviewStatus !== "ALL" || reportStatus !== "ALL" || columnId || search
  );
  const contentFiltersApplied = Boolean(
    status !== "ALL" ||
      type !== "ALL" ||
      reviewStatus !== "ALL" ||
      reportStatus !== "ALL" ||
      columnId ||
      search ||
      String(input.startDate || "").trim() ||
      String(input.endDate || "").trim()
  );
  const todayStart = startOfDay(new Date());
  const yesterdayStart = startOfDay(new Date(todayStart));
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = endOfDay(new Date(yesterdayStart));

  const where = {
    groupId: group.id,
  };
  const reportSummaryWhere = {
    groupId: group.id,
  };
  const metadataFilters = [];
  const reportSummaryMetadataFilters = [];

  if (status !== "ALL") {
    where.status = status;
    reportSummaryWhere.status = status;
  }

  if (type !== "ALL") {
    where.type = type;
    reportSummaryWhere.type = type;
  }

  if (reviewStatus !== "ALL" && !requiresUnsetReviewFilter) {
    metadataFilters.push({
      path: ["reviewStatus"],
      equals: reviewStatus,
    });
    reportSummaryMetadataFilters.push({
      path: ["reviewStatus"],
      equals: reviewStatus,
    });
  }

  if (reportStatus !== "ALL" && !requiresUnsetReportFilter) {
    metadataFilters.push({
      path: ["reportStatus"],
      equals: reportStatus,
    });
  }

  if (columnId) {
    metadataFilters.push({
      path: ["columnId"],
      equals: columnId,
    });
    reportSummaryMetadataFilters.push({
      path: ["columnId"],
      equals: columnId,
    });
  }

  applyMetadataFilters(where, metadataFilters);
  applyMetadataFilters(reportSummaryWhere, reportSummaryMetadataFilters);

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
      { contentText: { contains: search, mode: "insensitive" } },
      { author: { profile: { nickname: { contains: search, mode: "insensitive" } } } },
    ];
    reportSummaryWhere.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
      { contentText: { contains: search, mode: "insensitive" } },
      { author: { profile: { nickname: { contains: search, mode: "insensitive" } } } },
    ];
  }

  if (reportDateWhere) {
    Object.assign(where, reportDateWhere);
    Object.assign(reportSummaryWhere, reportDateWhere);
  }

  let total = 0;
  let rows = [];
  let statusGroups = [];
  let typeGroups = [];
  let contentTrendRows = [];
  let allContentStatRows = [];
  let latestContentStat = null;
  let yesterdayContentStat = null;
  let summaryRows = [];
  let reportSummaryRows = [];
  const requiresInMemoryContentFilter = requiresUnsetReviewFilter || requiresUnsetReportFilter;

  if (requiresInMemoryContentFilter) {
    const [allRows, nextStatusGroups, nextTypeGroups, nextContentTrendRows, nextAllContentStatRows, nextLatestContentStat, nextYesterdayContentStat] =
      await Promise.all([
        prisma.post.findMany({
          where,
          include: {
            author: {
              include: {
                profile: true,
              },
            },
          },
          orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        }),
        prisma.post.groupBy({
          by: ["status"],
          where: { groupId: group.id },
          _count: { _all: true },
        }),
        prisma.post.groupBy({
          by: ["type"],
          where: {
            groupId: group.id,
            status: {
              not: "DELETED",
            },
          },
          _count: { _all: true },
        }),
        prisma.groupContentDailyStat.findMany({
          where: {
            groupId: group.id,
            statDate: {
              gte: trendRange.startDate,
              lte: trendRange.endDate,
            },
          },
          orderBy: {
            statDate: "asc",
          },
        }),
        prisma.groupContentDailyStat.findMany({
          where: {
            groupId: group.id,
          },
          orderBy: {
            statDate: "asc",
          },
        }),
        prisma.groupContentDailyStat.findFirst({
          where: {
            groupId: group.id,
          },
          orderBy: {
            statDate: "desc",
          },
        }),
        prisma.groupContentDailyStat.findFirst({
          where: {
            groupId: group.id,
            statDate: {
              gte: yesterdayStart,
              lte: yesterdayEnd,
            },
          },
          orderBy: {
            statDate: "desc",
          },
        }),
      ]);

    const filteredRows = allRows.filter((post) =>
      matchesContentUnsetFilters(parseMetadata(post.metadata), {
        requiresUnsetReviewFilter,
        requiresUnsetReportFilter,
      })
    );
    total = filteredRows.length;
    rows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
    summaryRows = filteredRows;
    statusGroups = nextStatusGroups;
    typeGroups = nextTypeGroups;
    contentTrendRows = nextContentTrendRows;
    allContentStatRows = nextAllContentStatRows;
    latestContentStat = nextLatestContentStat;
    yesterdayContentStat = nextYesterdayContentStat;
  } else {
    [
      total,
      rows,
      summaryRows,
      statusGroups,
      typeGroups,
      contentTrendRows,
      allContentStatRows,
      latestContentStat,
      yesterdayContentStat,
    ] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        include: {
          author: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.post.findMany({
        where,
        select: {
          status: true,
          type: true,
          metadata: true,
          attachments: true,
          commentCount: true,
          likeCount: true,
        },
      }),
      prisma.post.groupBy({
        by: ["status"],
        where: { groupId: group.id },
        _count: { _all: true },
      }),
      prisma.post.groupBy({
        by: ["type"],
        where: {
          groupId: group.id,
          status: {
            not: "DELETED",
          },
        },
        _count: { _all: true },
      }),
      prisma.groupContentDailyStat.findMany({
        where: {
          groupId: group.id,
          statDate: {
            gte: trendRange.startDate,
            lte: trendRange.endDate,
          },
        },
        orderBy: {
          statDate: "asc",
        },
      }),
      prisma.groupContentDailyStat.findMany({
        where: {
          groupId: group.id,
        },
        orderBy: {
          statDate: "asc",
        },
      }),
      prisma.groupContentDailyStat.findFirst({
        where: {
          groupId: group.id,
        },
        orderBy: {
          statDate: "desc",
        },
      }),
      prisma.groupContentDailyStat.findFirst({
        where: {
          groupId: group.id,
          statDate: {
            gte: yesterdayStart,
            lte: yesterdayEnd,
          },
        },
        orderBy: {
          statDate: "desc",
        },
      }),
    ]);
  }

  if (reportStatus !== "ALL" || requiresUnsetReportFilter) {
    reportSummaryRows = await prisma.post.findMany({
      where: reportSummaryWhere,
      select: {
        metadata: true,
      },
    });

    if (requiresUnsetReviewFilter) {
      reportSummaryRows = reportSummaryRows.filter((post) => hasUnsetReviewStatus(parseMetadata(post.metadata)));
    }
  } else {
    reportSummaryRows = summaryRows;
  }

  const columnTitleMap = await buildColumnTitleMap(group.id, rows);
  const filteredSummary = buildFilteredContentSummary(summaryRows);
  const overviewSourceRows =
    status === "ALL" ? summaryRows.filter((post) => String(post.status || "") !== "DELETED") : summaryRows;
  const overviewSummary = buildFilteredContentSummary(overviewSourceRows);
  const reportSummary = buildAdminContentReportSummary(reportSummaryRows);

  const summaryByStatus = statusGroups.reduce((acc, item) => {
    acc[item.status] = item._count._all;
    return acc;
  }, {});

  const summaryByType = typeGroups.reduce((acc, item) => {
    acc[item.type] = item._count._all;
    return acc;
  }, {});

  let interactionTrend = [];
  let trendTopicCount = 0;
  let trendFileCount = 0;
  let trendImageCount = 0;
  let trendCommentCount = 0;
  let trendLikeCount = 0;
  const latestOverviewStat = yesterdayContentStat || latestContentStat;

  if (contentTrendFiltersApplied) {
    const trendWhere = {
      groupId: group.id,
      createdAt: {
        gte: trendRange.startDate,
        lte: trendRange.endDate,
      },
    };
    const trendMetadataFilters = [];

    if (status !== "ALL") {
      trendWhere.status = status;
    }

    if (type !== "ALL") {
      trendWhere.type = type;
    }

    if (reviewStatus !== "ALL" && !requiresUnsetReviewFilter) {
      trendMetadataFilters.push({
        path: ["reviewStatus"],
        equals: reviewStatus,
      });
    }

    if (reportStatus !== "ALL" && !requiresUnsetReportFilter) {
      trendMetadataFilters.push({
        path: ["reportStatus"],
        equals: reportStatus,
      });
    }

    if (columnId) {
      trendMetadataFilters.push({
        path: ["columnId"],
        equals: columnId,
      });
    }

    applyMetadataFilters(trendWhere, trendMetadataFilters);

    if (search) {
      trendWhere.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
        { contentText: { contains: search, mode: "insensitive" } },
        { author: { profile: { nickname: { contains: search, mode: "insensitive" } } } },
      ];
    }

    let trendPosts = await prisma.post.findMany({
      where: trendWhere,
      select: {
        createdAt: true,
        publishedAt: true,
        attachments: true,
        metadata: true,
        commentCount: true,
        likeCount: true,
      },
      orderBy: [{ createdAt: "asc" }],
    });

    if (requiresInMemoryContentFilter) {
      trendPosts = trendPosts.filter((post) =>
        matchesContentUnsetFilters(parseMetadata(post.metadata), {
          requiresUnsetReviewFilter,
          requiresUnsetReportFilter,
        })
      );
    }

    const filteredTrend = buildContentTrendFromPosts(trendPosts, trendRange);
    interactionTrend = filteredTrend.interactionTrend;
    trendTopicCount = filteredTrend.trendTopicCount;
    trendFileCount = filteredTrend.trendFileCount;
    trendImageCount = filteredTrend.trendImageCount;
    trendCommentCount = filteredTrend.trendCommentCount;
    trendLikeCount = filteredTrend.trendLikeCount;
  } else {
    const trendMap = new Map(
      contentTrendRows.map((item) => [new Date(item.statDate).toISOString().slice(0, 10), item])
    );

    for (let offset = 0; offset < trendRange.rangeDays; offset += 1) {
      const date = startOfDay(new Date(trendRange.startDate));
      date.setDate(trendRange.startDate.getDate() + offset);
      const dateKey = date.toISOString().slice(0, 10);
      const stat = trendMap.get(dateKey);
      const topicCount = stat ? stat.topicCount : 0;
      const fileCount = stat ? stat.fileCount : 0;
      const imageCount = stat ? stat.imageCount : 0;
      const commentCount = stat ? stat.commentCount : 0;
      const likeCount = stat ? stat.likeCount : 0;

      trendTopicCount += topicCount;
      trendFileCount += fileCount;
      trendImageCount += imageCount;
      trendCommentCount += commentCount;
      trendLikeCount += likeCount;

      interactionTrend.push({
        date: dateKey,
        label: formatStatDate(date),
        topicCount,
        fileCount,
        imageCount,
        commentCount,
        likeCount,
      });
    }
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
        },
        viewer,
        filters: {
          status,
          type,
          reviewStatus,
          reportStatus,
          columnId,
          search,
          startDate: String(input.startDate || ""),
          endDate: String(input.endDate || ""),
          rangeDays: trendRange.rangeDays,
        },
        summary: {
          total: Object.values(summaryByStatus).reduce((sum, value) => sum + value, 0),
          published: summaryByStatus.PUBLISHED || 0,
          hidden: summaryByStatus.HIDDEN || 0,
          draft: summaryByStatus.DRAFT || 0,
          deleted: summaryByStatus.DELETED || 0,
          topic: overviewSummary.topicTotal,
          article: summaryByType.ARTICLE || 0,
          notice: summaryByType.NOTICE || 0,
          fileCount: overviewSummary.fileTotal,
          imageCount: overviewSummary.imageTotal,
          commentCount: overviewSummary.commentTotal,
          likeCount: overviewSummary.likeTotal,
          reportPending: reportSummary.reportPending,
          reportResolved: reportSummary.reportResolved,
          reportIgnored: reportSummary.reportIgnored,
          reportTotal: reportSummary.reportTotal,
          latestReportedAt: reportSummary.latestReportedAt,
          trendTopicCount,
          filtersApplied: contentFiltersApplied,
          filtered: filteredSummary,
          overview: {
            topicTotal: overviewSummary.topicTotal,
            topicAddedYesterday: latestOverviewStat ? latestOverviewStat.topicCount : 0,
            fileTotal: overviewSummary.fileTotal,
            fileAddedYesterday: latestOverviewStat ? latestOverviewStat.fileCount : 0,
            imageTotal: overviewSummary.imageTotal,
            imageAddedYesterday: latestOverviewStat ? latestOverviewStat.imageCount : 0,
            commentTotal: overviewSummary.commentTotal,
            commentAddedYesterday: latestOverviewStat ? latestOverviewStat.commentCount : 0,
            likeTotal: overviewSummary.likeTotal,
            likeAddedYesterday: latestOverviewStat ? latestOverviewStat.likeCount : 0,
          },
          range: {
            topicCount: trendTopicCount,
            fileCount: trendFileCount,
            imageCount: trendImageCount,
            commentCount: trendCommentCount,
            likeCount: trendLikeCount,
          },
        },
        interactionTrend,
        pagination: buildPagination(total, page, pageSize),
        items: rows.map((post) => {
          const profile = profileOf(post.author);
          const metadata = parseMetadata(post.metadata);
          const article = buildArticlePayload(post, {
            metadata,
            group,
            author: post.author,
          });
          const reviewValue = normalizeReviewStatusValue(metadata.reviewStatus);
          const reportSnapshot = buildContentReportSnapshot(metadata);
          const resolvedTitle = article ? article.title : post.title || post.summary || post.contentText.slice(0, 48) || "无标题内容";
          const resolvedSummary = article ? article.summary : post.summary || post.contentText.slice(0, 120);
          const resolvedAuthorName = article ? article.authorDisplay.name || profile.nickname || "微信用户" : profile.nickname || "微信用户";
          const resolvedAuthorAvatarUrl = article
            ? article.authorDisplay.avatarUrl || profile.avatarUrl || ""
            : profile.avatarUrl || "";
          return {
            id: post.id,
            title: resolvedTitle,
            summary: resolvedSummary,
            authorName: resolvedAuthorName,
            authorAvatarUrl: resolvedAuthorAvatarUrl,
            type: post.type,
            typeLabel: mapPostType(post.type),
            status: post.status,
            statusLabel: mapPostStatus(post.status),
            reviewStatus: reviewValue || "UNSET",
            reviewStatusLabel: mapReviewStatus(reviewValue),
            reviewReason: metadata.reviewReason || "",
            reportStatus: reportSnapshot.reportStatus || "UNSET",
            reportStatusLabel: mapReportStatus(reportSnapshot.reportStatus),
            reportTotal: reportSnapshot.reportTotal,
            reportPendingCount: reportSnapshot.reportPendingCount,
            reportResolvedCount: reportSnapshot.reportResolvedCount,
            reportIgnoredCount: reportSnapshot.reportIgnoredCount,
            latestReportReason: reportSnapshot.latestReportReason,
            latestReportedAt: reportSnapshot.latestReportedAt,
            reportResolutionNote: reportSnapshot.reportResolutionNote,
            reportLogs: buildAdminContentReportLogs(reportSnapshot),
            isPinned: post.isPinned,
            isEssence: post.isEssence,
            readingCount: post.readingCount,
            likeCount: post.likeCount,
            commentCount: post.commentCount,
            columnId: metadata.columnId || "",
            columnTitle: resolvePostColumnTitle(metadata, columnTitleMap),
            answerStatus: metadata.answerStatus || "",
            contentSource: article ? article.contentSource : "",
            authorDisplay: article ? article.authorDisplay : null,
            article,
            attachments: Array.isArray(post.attachments) ? post.attachments : [],
            publishedAt: toIso(post.publishedAt),
            createdAt: toIso(post.createdAt),
            updatedAt: toIso(post.updatedAt),
          };
        }),
      },
    },
  };
}

async function exportAdminMembers(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;
  const viewerAccess = ensureAdminViewerCapability(guard, "canViewDashboard", "当前角色未开启成员后台查看权限");
  if (viewerAccess.error) {
    return viewerAccess.error;
  }
  const viewer = viewerAccess.viewer;

  const page = parsePositiveInt(input.page, 1, 9999);
  const pageSize = parsePositiveInt(input.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const status = String(input.status || "").trim().toUpperCase() || "ALL";
  const sourceType = normalizeAdminMemberSourceType(input.sourceType);
  const search = String(input.search || "").trim();
  const scope = String(input.scope || "current").trim().toLowerCase() === "all" ? "all" : "current";
  const reportDateWhere = buildReportDateWhere("joinedAt", input);
  const shouldLoadMembers = sourceType !== "APPLICATION" && (status === "ALL" || !isJoinApplicationStatus(status));
  const shouldLoadApplications = sourceType !== "MEMBER" && (status === "ALL" || isJoinApplicationStatus(status));
  const exportApplicationsOnly = sourceType === "APPLICATION" || status === "PENDING" || status === "REJECTED";

  const memberWhere = {
    groupId: group.id,
  };

  if (shouldLoadMembers && status !== "ALL" && !isJoinApplicationStatus(status)) {
    memberWhere.status = status;
  }

  if (shouldLoadMembers && search) {
    memberWhere.OR = [{ user: { profile: { nickname: { contains: search, mode: "insensitive" } } } }];

    if (viewer.capabilities.canViewMemberContact) {
      memberWhere.OR.unshift(
        { phone: { contains: search } },
        { wechatNo: { contains: search } },
        { user: { mobile: { contains: search } } }
      );
    }
  }

  if (shouldLoadMembers && reportDateWhere) {
    Object.assign(memberWhere, reportDateWhere);
  }

  const [rows, staffs, reviewApplications] = await Promise.all([
    shouldLoadMembers
      ? prisma.groupMember.findMany({
          where: memberWhere,
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
          orderBy: [{ status: "asc" }, { joinedAt: "desc" }, { memberNo: "asc" }],
        })
      : Promise.resolve([]),
    prisma.groupStaff.findMany({
      where: {
        groupId: group.id,
        isActive: true,
      },
      select: {
        userId: true,
        role: true,
      },
    }),
    shouldLoadApplications ? listGroupJoinReviewApplications(group.id) : Promise.resolve([]),
  ]);

  const filteredReviewApplications = reviewApplications.filter((item) => {
    if (status === "PENDING") {
      return item.reviewStatus === "PENDING";
    }

    if (status === "REJECTED") {
      return item.reviewStatus === "REJECTED";
    }

    return true;
  });

  const topicGroups = await prisma.post.groupBy({
    by: ["authorUserId"],
    where: {
      groupId: group.id,
      status: {
        not: "DELETED",
      },
      authorUserId: {
        in:
          rows.length || filteredReviewApplications.length
            ? Array.from(
                new Set(
                  rows.map((member) => member.userId).concat(filteredReviewApplications.map((item) => item.order.userId))
                )
              )
            : ["__never__"],
      },
    },
    _count: {
      _all: true,
    },
  });

  const topicCountMap = new Map(topicGroups.map((item) => [item.authorUserId, item._count._all]));
  const staffMap = new Map(staffs.map((staff) => [staff.userId, staff]));
  const now = Date.now();
  const memberItems = rows.map((member) => buildAdminMemberRow(group, member, staffMap, topicCountMap, now));
  const applicationItems = filterAdminMemberRowsByDate(
    filterAdminMemberRowsBySearch(
      filteredReviewApplications.map((item) => buildAdminJoinApplicationRow(group, item, staffMap, topicCountMap)),
      search,
      {
        includeContactFields: viewer.capabilities.canViewMemberContact,
      }
    ),
    input
  );
  const combinedItems = [];
  if (shouldLoadApplications) {
    combinedItems.push(...applicationItems);
  }
  if (shouldLoadMembers) {
    combinedItems.push(...memberItems);
  }
  const sortedItems = applyAdminMemberContactVisibility(
    [...combinedItems].sort(compareAdminMemberRows),
    viewer.capabilities.canViewMemberContact
  );
  const exportItems =
    scope === "current" ? sortedItems.slice((page - 1) * pageSize, page * pageSize) : sortedItems;

  const csvContent = exportApplicationsOnly
    ? buildCsvContent(
        [
          "申请单号",
          "用户昵称",
          "角色",
          "审核状态",
          "手机号",
          "微信号",
          "加入来源",
          "是否已支付",
          "申请时间",
          "审核时间",
          "审核备注",
          "重新提交次数",
          "最近重提时间",
          "主题数",
        ],
        exportItems.map((item) => [
          item.orderNo || "",
          item.nickname || "微信用户",
          item.roleLabel,
          item.statusLabel,
          viewer.capabilities.canViewMemberContact ? item.mobile || "" : "无权限查看",
          viewer.capabilities.canViewMemberContact ? item.wechatNo || "" : "无权限查看",
          item.joinSource || "",
          item.isPaid ? "是" : "否",
          formatDateTimeForDisplay(item.appliedAt || item.firstJoinedAt || item.joinedAt),
          formatDateTimeForDisplay(item.reviewedAt),
          item.reviewReason || "",
          item.reapplyCount || 0,
          formatDateTimeForDisplay(item.lastReappliedAt),
          item.topicCount,
        ])
      )
    : buildCsvContent(
        [
          "成员编号",
          "用户昵称",
          "角色",
          "状态",
          "手机号",
          "微信号",
          "加入来源",
          "是否付费",
          "首次加入时间",
          "最后活跃时间",
          "到期时间",
          "已续期数",
          "主题数",
          "即将到期",
          "申请单号",
          "审核备注",
          "审核时间",
          "重新提交次数",
          "最近重提时间",
        ],
        exportItems.map((item) => {
          const expireTime = item.expireAt ? new Date(item.expireAt).getTime() : null;
          return [
            item.memberNo || "",
            item.nickname || "微信用户",
            item.roleLabel,
            item.statusLabel,
            viewer.capabilities.canViewMemberContact ? item.mobile || "" : "无权限查看",
            viewer.capabilities.canViewMemberContact ? item.wechatNo || "" : "无权限查看",
            item.joinSource || "",
            item.isPaid ? "是" : "否",
            formatDateTimeForDisplay(item.firstJoinedAt || item.joinedAt),
            formatDateTimeForDisplay(item.lastActiveAt),
            formatDateForDisplay(item.expireAt),
            item.renewTimes,
            item.topicCount,
            item.status === "ACTIVE" &&
            expireTime !== null &&
            expireTime > now &&
            expireTime - now <= 30 * 24 * 60 * 60 * 1000
              ? "是"
              : "否",
            item.orderNo || "",
            item.reviewReason || "",
            formatDateTimeForDisplay(item.reviewedAt),
            item.reapplyCount || 0,
            formatDateTimeForDisplay(item.lastReappliedAt),
          ];
        })
      );

  const fileName = buildExportFileName(
    exportApplicationsOnly
      ? scope === "all"
        ? "application-review-report-all"
        : "application-review-report-page"
      : scope === "all"
        ? "member-report-all"
        : "member-report-page",
    group
  );
  await recordExportTask({
    groupId: group.id,
    type: "MEMBER_REPORT",
    fileName,
    beginTime: parseDateOnly(input.startDate),
    endTime: parseDateOnly(input.endDate),
    onlyValidMembers: status === "ACTIVE",
  });

  return {
    statusCode: 200,
    payload: csvContent,
    contentType: "text/csv; charset=utf-8",
    fileName,
  };
}

async function updateAdminMemberReview(input = {}) {
  const groupId = String(input.groupId || "").trim();
  const orderNo = String(input.orderNo || "").trim();
  const action = String(input.action || "").trim().toUpperCase();
  const sessionToken = String(input.sessionToken || "").trim();

  if (!groupId || !orderNo) {
    return { statusCode: 400, payload: { ok: false, message: "缺少成员审核所需参数" } };
  }

  const guard = await ensureGroupManager(groupId, sessionToken);
  if (guard.error) {
    return guard.error;
  }
  const viewerAccess = ensureAdminViewerCapability(guard, "canManageMembers", "当前角色仅可查看成员数据，不能处理成员审核");
  if (viewerAccess.error) {
    return viewerAccess.error;
  }

  const result = await reviewJoinApplication({
    groupId,
    orderNo,
    action,
    reviewReason: input.reviewReason,
    reviewerUserId: guard.session.userId,
  });

  if (result.statusCode !== 200) {
    return result;
  }

  const membership = result.payload.data && result.payload.data.membership ? result.payload.data.membership : null;
  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        action,
        orderNo,
        membershipStatus: membership ? membership.status : "",
        idempotent: Boolean(result.payload.data && result.payload.data.idempotent),
      },
    },
  };
}

async function updateAdminMemberStatus(input = {}) {
  const groupId = String(input.groupId || "").trim();
  const memberId = String(input.memberId || "").trim();
  const status = String(input.status || "").trim().toUpperCase();
  const sessionToken = String(input.sessionToken || "").trim();

  if (!groupId || !memberId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少成员状态变更所需参数" } };
  }

  if (status !== "QUIT") {
    return { statusCode: 400, payload: { ok: false, message: "当前仅支持踢出成员" } };
  }

  const guard = await ensureGroupManager(groupId, sessionToken);
  if (guard.error) {
    return guard.error;
  }
  const viewerAccess = ensureAdminViewerCapability(guard, "canManageMembers", "当前角色仅可查看成员数据，不能踢出成员");
  if (viewerAccess.error) {
    return viewerAccess.error;
  }

  const member = await prisma.groupMember.findFirst({
    where: {
      id: memberId,
      groupId,
    },
    select: {
      id: true,
      userId: true,
      status: true,
    },
  });

  if (!member) {
    return { statusCode: 404, payload: { ok: false, message: "成员不存在" } };
  }

  if (member.userId === guard.group.ownerUserId) {
    return { statusCode: 400, payload: { ok: false, message: "星主不能被踢出" } };
  }

  const activeStaff = await prisma.groupStaff.findFirst({
    where: {
      groupId,
      userId: member.userId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (activeStaff) {
    return { statusCode: 400, payload: { ok: false, message: "请先移除该成员的后台身份后再踢出" } };
  }

  if (member.status === "QUIT") {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          memberId: member.id,
          membershipStatus: member.status,
          idempotent: true,
        },
      },
    };
  }

  const updatedMember = await prisma.groupMember.update({
    where: {
      id: member.id,
    },
    data: {
      status: "QUIT",
    },
    select: {
      id: true,
      status: true,
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        memberId: updatedMember.id,
        membershipStatus: updatedMember.status,
        idempotent: false,
      },
    },
  };
}

async function exportAdminContent(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;
  const viewerAccess = ensureAdminViewerCapability(guard, "canViewDashboard", "当前角色未开启内容后台查看权限");
  if (viewerAccess.error) {
    return viewerAccess.error;
  }

  const page = parsePositiveInt(input.page, 1, 9999);
  const pageSize = parsePositiveInt(input.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const status = String(input.status || "").trim().toUpperCase() || "ALL";
  const type = String(input.type || "").trim().toUpperCase() || "ALL";
  const reviewStatus = String(input.reviewStatus || "").trim().toUpperCase() || "ALL";
  const reportStatus = normalizeReportStatusValue(input.reportStatus) || "ALL";
  const requiresUnsetReviewFilter = reviewStatus === "UNSET";
  const requiresUnsetReportFilter = reportStatus === "UNSET";
  const columnId = String(input.columnId || "").trim();
  const search = String(input.search || "").trim();
  const scope = String(input.scope || "current").trim().toLowerCase() === "all" ? "all" : "current";
  const reportDateWhere = buildReportDateWhere("createdAt", input);

  const where = {
    groupId: group.id,
  };
  const metadataFilters = [];

  if (status !== "ALL") {
    where.status = status;
  }

  if (type !== "ALL") {
    where.type = type;
  }

  if (reviewStatus !== "ALL" && !requiresUnsetReviewFilter) {
    metadataFilters.push({
      path: ["reviewStatus"],
      equals: reviewStatus,
    });
  }

  if (reportStatus !== "ALL" && !requiresUnsetReportFilter) {
    metadataFilters.push({
      path: ["reportStatus"],
      equals: reportStatus,
    });
  }

  if (columnId) {
    metadataFilters.push({
      path: ["columnId"],
      equals: columnId,
    });
  }

  applyMetadataFilters(where, metadataFilters);

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
      { contentText: { contains: search, mode: "insensitive" } },
      { author: { profile: { nickname: { contains: search, mode: "insensitive" } } } },
    ];
  }

  if (reportDateWhere) {
    Object.assign(where, reportDateWhere);
  }

  let exportRows = [];

  if (requiresUnsetReviewFilter || requiresUnsetReportFilter) {
    const allRows = await prisma.post.findMany({
      where,
      include: {
        author: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    });

    const filteredRows = allRows.filter((post) =>
      matchesContentUnsetFilters(parseMetadata(post.metadata), {
        requiresUnsetReviewFilter,
        requiresUnsetReportFilter,
      })
    );
    exportRows =
      scope === "current" ? filteredRows.slice((page - 1) * pageSize, page * pageSize) : filteredRows;
  } else {
    exportRows = await prisma.post.findMany({
      where,
      include: {
        author: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      skip: scope === "current" ? (page - 1) * pageSize : undefined,
      take: scope === "current" ? pageSize : undefined,
    });
  }

  const columnTitleMap = await buildColumnTitleMap(group.id, exportRows);

  const csvContent = buildCsvContent(
    [
      "主题",
      "作者",
      "类型",
      "状态",
      "审核状态",
      "审核原因",
      "举报状态",
      "举报次数",
      "待处理举报",
      "最近举报原因",
      "举报处理备注",
      "置顶",
      "精华",
      "阅读数",
      "点赞数",
      "评论数",
      "专栏",
      "发布时间",
      "更新时间",
    ],
    exportRows.map((post) => {
      const profile = profileOf(post.author);
      const metadata = parseMetadata(post.metadata);
      const reviewValue = normalizeReviewStatusValue(metadata.reviewStatus);
      const reportSnapshot = buildContentReportSnapshot(metadata);
      return [
        post.title || post.summary || post.contentText.slice(0, 48) || "无标题内容",
        profile.nickname || "微信用户",
        mapPostType(post.type),
        mapPostStatus(post.status),
        mapReviewStatus(reviewValue),
        metadata.reviewReason || "",
        mapReportStatus(reportSnapshot.reportStatus),
        reportSnapshot.reportTotal,
        reportSnapshot.reportPendingCount,
        reportSnapshot.latestReportReason,
        reportSnapshot.reportResolutionNote,
        post.isPinned ? "是" : "否",
        post.isEssence ? "是" : "否",
        post.readingCount,
        post.likeCount,
        post.commentCount,
        resolvePostColumnTitle(metadata, columnTitleMap),
        formatDateTimeForDisplay(post.publishedAt || post.createdAt),
        formatDateTimeForDisplay(post.updatedAt),
      ];
    })
  );

  const fileName = buildExportFileName(scope === "all" ? "content-report-all" : "content-report-page", group);
  await recordExportTask({
    groupId: group.id,
    type: "CONTENT_REPORT",
    fileName,
    beginTime: parseDateOnly(input.startDate),
    endTime: parseDateOnly(input.endDate),
  });

  return {
    statusCode: 200,
    payload: csvContent,
    contentType: "text/csv; charset=utf-8",
    fileName,
  };
}

async function getAdminScoreboard(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;

  const page = parsePositiveInt(input.page, 1, 9999);
  const pageSize = parsePositiveInt(input.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const range = buildTrendRange(input);
  const memberStatus = String(input.memberStatus || "ACTIVE").trim().toUpperCase() || "ACTIVE";
  const search = String(input.search || "").trim();

  const memberWhere = {
    groupId: group.id,
  };

  if (memberStatus !== "ALL") {
    memberWhere.status = memberStatus;
  }

  if (search) {
    memberWhere.OR = [
      { phone: { contains: search } },
      { wechatNo: { contains: search } },
      { user: { mobile: { contains: search } } },
      { user: { profile: { nickname: { contains: search, mode: "insensitive" } } } },
    ];
  }

  const [members, staffs, scoreRules, scoreboardSetting] = await Promise.all([
    prisma.groupMember.findMany({
      where: memberWhere,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { joinedAt: "asc" }, { memberNo: "asc" }],
    }),
    prisma.groupStaff.findMany({
      where: {
        groupId: group.id,
        isActive: true,
      },
      select: {
        userId: true,
        role: true,
      },
    }),
    prisma.scoreRule.findMany({
      where: {
        groupId: group.id,
        isEnabled: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.scoreboardSetting.findUnique({
      where: {
        groupId: group.id,
      },
    }),
  ]);

  const userIds = members.length ? members.map((member) => member.userId) : ["__never__"];
  const postDateWhere = {
    gte: range.startDate,
    lte: range.endDate,
  };

  const [posts, comments] = await Promise.all([
    prisma.post.findMany({
      where: {
        groupId: group.id,
        authorUserId: {
          in: userIds,
        },
        status: {
          not: "DELETED",
        },
        createdAt: postDateWhere,
      },
      select: {
        authorUserId: true,
        type: true,
        likeCount: true,
      },
    }),
    prisma.comment.findMany({
      where: {
        userId: {
          in: userIds,
        },
        status: "PUBLISHED",
        createdAt: postDateWhere,
        post: {
          groupId: group.id,
        },
      },
      select: {
        userId: true,
        likeCount: true,
      },
    }),
  ]);

  const staffMap = new Map(staffs.map((staff) => [staff.userId, staff]));
  const defaultRuleMap = new Map(SCOREBOARD_RULE_DEFINITIONS.map((item) => [item.eventType, item.defaultScore]));
  const ruleMap = new Map(defaultRuleMap);
  for (const rule of scoreRules) {
    ruleMap.set(rule.eventType, toNumber(rule.score));
  }

  const statMap = new Map(
    members.map((member) => [
      member.userId,
      {
        postCount: 0,
        commentCount: 0,
        checkinCount: 0,
        assignmentCount: 0,
        likeReceived: 0,
        totalScore: 0,
      },
    ])
  );

  for (const post of posts) {
    const stat = statMap.get(post.authorUserId);
    if (!stat) {
      continue;
    }

    stat.postCount += 1;
    stat.likeReceived += toNumber(post.likeCount);

    if (post.type === "CHECKIN") {
      stat.checkinCount += 1;
      stat.totalScore += ruleMap.get("CHECKIN_PUBLISH") || 0;
    } else if (post.type === "ASSIGNMENT") {
      stat.assignmentCount += 1;
      stat.totalScore += ruleMap.get("ASSIGNMENT_SUBMIT") || 0;
    } else {
      stat.totalScore += ruleMap.get("POST_PUBLISH") || 0;
    }

    stat.totalScore += toNumber(post.likeCount) * (ruleMap.get("POST_LIKE") || 0);
  }

  for (const comment of comments) {
    const stat = statMap.get(comment.userId);
    if (!stat) {
      continue;
    }

    stat.commentCount += 1;
    stat.likeReceived += toNumber(comment.likeCount);
    stat.totalScore += ruleMap.get("COMMENT_PUBLISH") || 0;
    stat.totalScore += toNumber(comment.likeCount) * (ruleMap.get("COMMENT_LIKE") || 0);
  }

  const rankedItems = members
    .map((member) => {
      const profile = profileOf(member.user);
      const stat = statMap.get(member.userId) || {
        postCount: 0,
        commentCount: 0,
        checkinCount: 0,
        assignmentCount: 0,
        likeReceived: 0,
        totalScore: 0,
      };

      return {
        id: member.id,
        userId: member.userId,
        nickname: profile.nickname || "微信用户",
        avatarUrl: profile.avatarUrl || "",
        roleLabel: buildRoleLabel(group, member, staffMap),
        status: member.status,
        statusLabel: mapMemberStatus(member.status),
        totalScore: Math.round(stat.totalScore),
        postCount: stat.postCount,
        commentCount: stat.commentCount,
        checkinCount: stat.checkinCount,
        assignmentCount: stat.assignmentCount,
        likeReceived: stat.likeReceived,
        lastActiveAt: toIso(member.lastActiveAt),
        joinedAt: toIso(member.joinedAt),
      };
    })
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }

      if (right.likeReceived !== left.likeReceived) {
        return right.likeReceived - left.likeReceived;
      }

      return (right.lastActiveAt || "").localeCompare(left.lastActiveAt || "");
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  const totalScore = rankedItems.reduce((sum, item) => sum + item.totalScore, 0);
  const scoredMembers = rankedItems.filter((item) => item.totalScore > 0).length;
  const pagedItems = rankedItems.slice((page - 1) * pageSize, page * pageSize);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
        },
        filters: {
          memberStatus,
          search,
          rangeDays: range.rangeDays,
        },
        settings: {
          enabled: scoreboardSetting ? scoreboardSetting.enabled : true,
          enabledHonor: scoreboardSetting ? scoreboardSetting.enabledHonor : false,
          excludePrivilegeUser: scoreboardSetting ? scoreboardSetting.excludePrivilegeUser : true,
          rulesUpdatedAt: scoreboardSetting ? toIso(scoreboardSetting.rulesUpdatedAt) : "",
        },
        summary: {
          trackedMembers: rankedItems.length,
          scoredMembers,
          totalScore,
          averageScore: rankedItems.length ? Math.round(totalScore / rankedItems.length) : 0,
          topScore: rankedItems[0] ? rankedItems[0].totalScore : 0,
          topMemberName: rankedItems[0] ? rankedItems[0].nickname : "",
        },
        rules: SCOREBOARD_RULE_DEFINITIONS.map((item) => ({
          eventType: item.eventType,
          label: item.label,
          score: ruleMap.get(item.eventType) || 0,
        })),
        pagination: buildPagination(rankedItems.length, page, pageSize),
        items: pagedItems,
      },
    },
  };
}

async function updateAdminScoreboard(input = {}) {
  const groupId = String(input.groupId || "").trim();
  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const guard = await ensureGroupManager(groupId, input.sessionToken);
  if (guard.error) {
    return guard.error;
  }

  const rawRules = Array.isArray(input.rules) ? input.rules : [];
  if (!rawRules.length) {
    return { statusCode: 400, payload: { ok: false, message: "缺少积分规则" } };
  }

  const existingRules = await prisma.scoreRule.findMany({
    where: {
      groupId,
    },
  });

  const ruleMap = new Map(SCOREBOARD_RULE_DEFINITIONS.map((item) => [item.eventType, item.defaultScore]));
  for (const rule of existingRules) {
    ruleMap.set(rule.eventType, toNumber(rule.score));
  }

  const seenEventTypes = new Set();
  for (const rawRule of rawRules) {
    const eventType = String(rawRule && rawRule.eventType ? rawRule.eventType : "").trim().toUpperCase();
    if (!SCOREBOARD_RULE_EVENT_TYPE_SET.has(eventType)) {
      return { statusCode: 400, payload: { ok: false, message: "存在不支持的积分行为" } };
    }

    if (seenEventTypes.has(eventType)) {
      return { statusCode: 400, payload: { ok: false, message: "积分行为重复提交" } };
    }

    const score = normalizeScoreboardRuleScore(rawRule ? rawRule.score : null);
    if (score === null) {
      const matchedDefinition = SCOREBOARD_RULE_DEFINITIONS.find((item) => item.eventType === eventType);
      return {
        statusCode: 400,
        payload: {
          ok: false,
          message: `${matchedDefinition ? matchedDefinition.label : "积分规则"} 需填写 0.0-10.0 之间的数值`,
        },
      };
    }

    ruleMap.set(eventType, score);
    seenEventTypes.add(eventType);
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.scoreboardSetting.upsert({
      where: {
        groupId,
      },
      update: {
        enabled: true,
        rulesUpdatedAt: now,
      },
      create: {
        groupId,
        enabled: true,
        enabledHonor: false,
        excludePrivilegeUser: true,
        rulesUpdatedAt: now,
      },
    }),
    ...SCOREBOARD_RULE_DEFINITIONS.map((item) =>
      prisma.scoreRule.upsert({
        where: {
          groupId_eventType: {
            groupId,
            eventType: item.eventType,
          },
        },
        update: {
          score: ruleMap.get(item.eventType) || item.defaultScore,
          isEnabled: true,
        },
        create: {
          groupId,
          eventType: item.eventType,
          score: ruleMap.get(item.eventType) || item.defaultScore,
          isEnabled: true,
        },
      })
    ),
  ]);

  return getAdminScoreboard({
    groupId,
    sessionToken: input.sessionToken,
    memberStatus: input.memberStatus || "ACTIVE",
    search: input.search || "",
    rangeDays: input.rangeDays || DEFAULT_TREND_DAYS,
    page: input.page || 1,
    pageSize: input.pageSize || MAX_PAGE_SIZE,
  });
}

function buildMemberVerificationWhere(verifyType, keyword) {
  const normalizedType = String(verifyType || "MEMBER_NO").trim().toUpperCase();
  const normalizedKeyword = String(keyword || "").trim();

  if (!normalizedKeyword) {
    return null;
  }

  if (normalizedType === "MEMBER_NO") {
    const parsed = Number(normalizedKeyword);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return {
      memberNo: parsed,
    };
  }

  if (normalizedType === "MOBILE") {
    return {
      user: {
        mobile: {
          contains: normalizedKeyword,
        },
      },
    };
  }

  if (normalizedType === "WECHAT_NO") {
    return {
      OR: [
        {
          wechatNo: {
            contains: normalizedKeyword,
          },
        },
        {
          user: {
            profile: {
              wechatNo: {
                contains: normalizedKeyword,
              },
            },
          },
        },
      ],
    };
  }

  return {
    user: {
      profile: {
        nickname: {
          contains: normalizedKeyword,
          mode: "insensitive",
        },
      },
    },
  };
}

function buildMemberVerificationResult(member) {
  if (!member) {
    return {
      matched: false,
      message: "未找到匹配成员",
    };
  }

  const profile = profileOf(member.user);
  return {
    matched: true,
    memberId: member.id,
    userId: member.userId,
    memberNo: member.memberNo,
    nickname: profile.nickname || "微信用户",
    mobile: member.user && member.user.mobile ? member.user.mobile : "",
    wechatNo: member.wechatNo || profile.wechatNo || "",
    status: member.status,
    statusLabel: mapMemberStatus(member.status),
    isActive: member.status === "ACTIVE",
    isPaid: Boolean(member.isPaid),
    expireAt: toIso(member.expireAt),
    joinedAt: toIso(member.joinedAt),
    message: member.status === "ACTIVE" ? "成员身份有效" : `成员当前状态为${mapMemberStatus(member.status)}`,
  };
}

async function findVerificationMember(groupId, verifyType, keyword) {
  const verificationWhere = buildMemberVerificationWhere(verifyType, keyword);
  if (!verificationWhere) {
    return null;
  }

  return prisma.groupMember.findFirst({
    where: {
      groupId,
      ...verificationWhere,
    },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { joinedAt: "desc" }],
  });
}

async function getAdminMemberVerification(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;

  const verifyType = String(input.verifyType || "MEMBER_NO").trim().toUpperCase() || "MEMBER_NO";
  const keyword = String(input.keyword || "").trim();

  const [activeCount, paidCount, totalCount, sampleMembers, matchedMember, statusCounts] = await Promise.all([
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        status: "ACTIVE",
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        status: "ACTIVE",
        isPaid: true,
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
      },
    }),
    prisma.groupMember.findMany({
      where: {
        groupId: group.id,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { joinedAt: "desc" }],
      take: 8,
    }),
    keyword ? findVerificationMember(group.id, verifyType, keyword) : Promise.resolve(null),
    Promise.all(
      MEMBER_VERIFICATION_STATUS_KEYS.map((status) =>
        prisma.groupMember.count({
          where: {
            groupId: group.id,
            status,
          },
        })
      )
    ),
  ]);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
        },
        summary: {
          activeCount,
          paidCount,
          totalCount,
          snapshotCount: Number(group.memberCount || 0),
          activeRate: totalCount > 0 ? Number((activeCount / totalCount).toFixed(4)) : 0,
          statusBuckets: MEMBER_VERIFICATION_STATUS_KEYS.map((status, index) => ({
            status,
            label: mapMemberStatus(status),
            count: statusCounts[index] || 0,
          })),
        },
        docs: {
          endpoint: "/api/member-verification/check",
          method: "GET",
          requiresLogin: false,
          supportedFields: ["MEMBER_NO", "MOBILE", "WECHAT_NO", "NICKNAME"],
        },
        verification: keyword
          ? buildMemberVerificationResult(matchedMember)
          : {
              matched: false,
              message: "请输入成员编号、手机号、微信号或昵称进行校验",
            },
        sampleMembers: sampleMembers.map((member) => {
          const profile = profileOf(member.user);
          return {
            id: member.id,
            memberNo: member.memberNo,
            nickname: profile.nickname || "微信用户",
            mobile: member.user && member.user.mobile ? member.user.mobile : "",
            wechatNo: member.wechatNo || profile.wechatNo || "",
            status: member.status,
            statusLabel: mapMemberStatus(member.status),
            isPaid: Boolean(member.isPaid),
            expireAt: toIso(member.expireAt),
            joinedAt: toIso(member.joinedAt),
          };
        }),
      },
    },
  };
}

async function getMemberVerificationCheck(input = {}) {
  const group = await resolveGroup(input.groupId);
  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  const verifyType = String(input.verifyType || "MEMBER_NO").trim().toUpperCase() || "MEMBER_NO";
  const keyword = String(input.keyword || "").trim();
  if (!keyword) {
    return { statusCode: 400, payload: { ok: false, message: "缺少校验关键词" } };
  }

  const matchedMember = await findVerificationMember(group.id, verifyType, keyword);
  const verification = buildMemberVerificationResult(matchedMember);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        groupId: group.id,
        groupName: group.name,
        verifyType,
        keyword,
        matched: verification.matched,
        member: verification.matched
          ? {
              memberNo: verification.memberNo,
              nickname: verification.nickname,
              status: verification.status,
              statusLabel: verification.statusLabel,
              isActive: verification.isActive,
              isPaid: verification.isPaid,
              expireAt: verification.expireAt,
              joinedAt: verification.joinedAt,
            }
          : null,
        message: verification.message,
      },
    },
  };
}

async function getAdminIncome(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;
  const dashboardAccess = ensureAdminViewerCapability(guard, "canViewDashboard", "当前角色未开启后台数据查看权限");
  if (dashboardAccess.error) {
    return dashboardAccess.error;
  }
  const incomeAccess = ensureAdminViewerCapability(guard, "canViewIncome", "当前角色未开启收入数据查看权限");
  if (incomeAccess.error) {
    return incomeAccess.error;
  }

  const trendRange = buildTrendRange(input);
  const reportDateWhere = buildReportDateWhere("paidAt", input);
  const page = parsePositiveInt(input.page, 1, 9999);
  const pageSize = parsePositiveInt(input.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const calendarRanges = buildIncomeCalendarRanges();
  const allPaidOrderWhere = {
    groupId: group.id,
    paymentStatus: "PAID",
  };
  const reportOrderWhere = {
    ...allPaidOrderWhere,
  };

  if (reportDateWhere && reportDateWhere.paidAt) {
    reportOrderWhere.paidAt = reportDateWhere.paidAt;
  }

  const [
    allPaidOrders,
    incomeStatRows,
    renewalStatRows,
    latestMemberStat,
    totalOrders,
    orderRows,
    yesterdayJoinedCount,
    yesterdayPaidJoinedCount,
    currentPaidCount,
    currentFreeCount,
  ] = await Promise.all([
    prisma.order.findMany({
      where: allPaidOrderWhere,
      select: {
        type: true,
        netAmount: true,
        paidAt: true,
        createdAt: true,
      },
    }),
    prisma.groupIncomeDailyStat.findMany({
      where: {
        groupId: group.id,
      },
      orderBy: {
        statDate: "asc",
      },
    }),
    prisma.groupRenewalDailyStat.findMany({
      where: {
        groupId: group.id,
      },
      orderBy: {
        statDate: "asc",
      },
    }),
    prisma.groupMemberDailyStat.findFirst({
      where: {
        groupId: group.id,
      },
      orderBy: {
        statDate: "desc",
      },
    }),
    prisma.order.count({ where: reportOrderWhere }),
    prisma.order.findMany({
      where: reportOrderWhere,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        joinedAt: {
          gte: calendarRanges.yesterdayStart,
          lte: calendarRanges.yesterdayEnd,
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        isPaid: true,
        joinedAt: {
          gte: calendarRanges.yesterdayStart,
          lte: calendarRanges.yesterdayEnd,
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        isPaid: true,
        status: {
          not: "QUIT",
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        isPaid: false,
        status: {
          not: "QUIT",
        },
      },
    }),
  ]);

  const joinPaidOrders = allPaidOrders.filter((order) => order.type === "GROUP_JOIN");
  const renewalPaidOrders = allPaidOrders.filter((order) => order.type === "GROUP_RENEWAL");
  const rewardPaidOrders = allPaidOrders.filter((order) => order.type === "REWARD");
  const questionPaidOrders = allPaidOrders.filter((order) => order.type === "QUESTION");
  const hasIncomeStatRows = incomeStatRows.length > 0;
  const hasRenewalStatRows = renewalStatRows.length > 0;
  const paidMembers = latestMemberStat ? latestMemberStat.paidMemberCount : currentPaidCount;
  const freeMembers = latestMemberStat ? latestMemberStat.freeMemberCount : currentFreeCount;
  const totalMembers = latestMemberStat ? latestMemberStat.totalMemberCount : paidMembers + freeMembers;

  const totalIncome = hasIncomeStatRows
    ? incomeStatRows.reduce((sum, row) => sum + toNumber(row.totalNetAmount), 0)
    : allPaidOrders.reduce((sum, order) => sum + toNumber(order.netAmount), 0);
  const weekIncome = hasIncomeStatRows
    ? sumDailyStatValue(incomeStatRows, calendarRanges.currentWeekStart, calendarRanges.currentWeekEnd, (row) => row.totalNetAmount)
    : sumOrderValue(allPaidOrders, calendarRanges.currentWeekStart, calendarRanges.currentWeekEnd, (order) => order.netAmount);
  const lastWeekIncome = hasIncomeStatRows
    ? sumDailyStatValue(incomeStatRows, calendarRanges.lastWeekStart, calendarRanges.lastWeekEnd, (row) => row.totalNetAmount)
    : sumOrderValue(allPaidOrders, calendarRanges.lastWeekStart, calendarRanges.lastWeekEnd, (order) => order.netAmount);
  const monthIncome = hasIncomeStatRows
    ? sumDailyStatValue(incomeStatRows, calendarRanges.currentMonthStart, calendarRanges.currentMonthEnd, (row) => row.totalNetAmount)
    : sumOrderValue(allPaidOrders, calendarRanges.currentMonthStart, calendarRanges.currentMonthEnd, (order) => order.netAmount);
  const lastMonthIncome = hasIncomeStatRows
    ? sumDailyStatValue(incomeStatRows, calendarRanges.lastMonthStart, calendarRanges.lastMonthEnd, (row) => row.totalNetAmount)
    : sumOrderValue(allPaidOrders, calendarRanges.lastMonthStart, calendarRanges.lastMonthEnd, (order) => order.netAmount);
  const yesterdayIncome = hasIncomeStatRows
    ? sumDailyStatValue(incomeStatRows, calendarRanges.yesterdayStart, calendarRanges.yesterdayEnd, (row) => row.totalNetAmount)
    : sumOrderValue(allPaidOrders, calendarRanges.yesterdayStart, calendarRanges.yesterdayEnd, (order) => order.netAmount);
  const joinIncome = hasIncomeStatRows
    ? incomeStatRows.reduce((sum, row) => sum + toNumber(row.joinNetAmount), 0)
    : joinPaidOrders.reduce((sum, order) => sum + toNumber(order.netAmount), 0);
  const yesterdayJoinIncome = hasIncomeStatRows
    ? sumDailyStatValue(incomeStatRows, calendarRanges.yesterdayStart, calendarRanges.yesterdayEnd, (row) => row.joinNetAmount)
    : sumOrderValue(joinPaidOrders, calendarRanges.yesterdayStart, calendarRanges.yesterdayEnd, (order) => order.netAmount);
  const renewalIncome = hasIncomeStatRows
    ? incomeStatRows.reduce((sum, row) => sum + toNumber(row.renewalNetAmount), 0)
    : renewalPaidOrders.reduce((sum, order) => sum + toNumber(order.netAmount), 0);
  const yesterdayRenewalIncome = hasIncomeStatRows
    ? sumDailyStatValue(incomeStatRows, calendarRanges.yesterdayStart, calendarRanges.yesterdayEnd, (row) => row.renewalNetAmount)
    : sumOrderValue(
        renewalPaidOrders,
        calendarRanges.yesterdayStart,
        calendarRanges.yesterdayEnd,
        (order) => order.netAmount
      );
  const rewardIncome = hasIncomeStatRows
    ? incomeStatRows.reduce((sum, row) => sum + toNumber(row.rewardNetAmount), 0)
    : rewardPaidOrders.reduce((sum, order) => sum + toNumber(order.netAmount), 0);
  const yesterdayRewardIncome = hasIncomeStatRows
    ? sumDailyStatValue(incomeStatRows, calendarRanges.yesterdayStart, calendarRanges.yesterdayEnd, (row) => row.rewardNetAmount)
    : sumOrderValue(rewardPaidOrders, calendarRanges.yesterdayStart, calendarRanges.yesterdayEnd, (order) => order.netAmount);
  const questionIncome = hasIncomeStatRows
    ? incomeStatRows.reduce((sum, row) => sum + toNumber(row.questionNetAmount), 0)
    : questionPaidOrders.reduce((sum, order) => sum + toNumber(order.netAmount), 0);
  const yesterdayQuestionIncome = hasIncomeStatRows
    ? sumDailyStatValue(incomeStatRows, calendarRanges.yesterdayStart, calendarRanges.yesterdayEnd, (row) => row.questionNetAmount)
    : sumOrderValue(
        questionPaidOrders,
        calendarRanges.yesterdayStart,
        calendarRanges.yesterdayEnd,
        (order) => order.netAmount
      );
  const monthRenewedCount = hasRenewalStatRows
    ? sumDailyStatValue(renewalStatRows, calendarRanges.currentMonthStart, calendarRanges.currentMonthEnd, (row) => row.renewedCount)
    : sumOrderValue(renewalPaidOrders, calendarRanges.currentMonthStart, calendarRanges.currentMonthEnd, () => 1);
  const lastMonthRenewedCount = hasRenewalStatRows
    ? sumDailyStatValue(renewalStatRows, calendarRanges.lastMonthStart, calendarRanges.lastMonthEnd, (row) => row.renewedCount)
    : sumOrderValue(renewalPaidOrders, calendarRanges.lastMonthStart, calendarRanges.lastMonthEnd, () => 1);
  const yesterdayRenewedCount = hasRenewalStatRows
    ? sumDailyStatValue(renewalStatRows, calendarRanges.yesterdayStart, calendarRanges.yesterdayEnd, (row) => row.renewedCount)
    : sumOrderValue(renewalPaidOrders, calendarRanges.yesterdayStart, calendarRanges.yesterdayEnd, () => 1);

  const trendMap = new Map();
  if (hasIncomeStatRows) {
    incomeStatRows.forEach((row) => {
      trendMap.set(buildDateKey(row.statDate), row);
    });
  } else {
    allPaidOrders.forEach((order) => {
      const paidAt = resolvePaidOrderDate(order);
      if (!paidAt) {
        return;
      }

      const dateKey = buildDateKey(paidAt);
      const current = trendMap.get(dateKey) || {
        totalNetAmount: 0,
        joinNetAmount: 0,
        renewalNetAmount: 0,
        rewardNetAmount: 0,
        questionNetAmount: 0,
      };

      const netAmount = toNumber(order.netAmount);
      current.totalNetAmount += netAmount;

      if (order.type === "GROUP_JOIN") {
        current.joinNetAmount += netAmount;
      } else if (order.type === "GROUP_RENEWAL") {
        current.renewalNetAmount += netAmount;
      } else if (order.type === "REWARD") {
        current.rewardNetAmount += netAmount;
      } else if (order.type === "QUESTION") {
        current.questionNetAmount += netAmount;
      }

      trendMap.set(dateKey, current);
    });
  }

  const trend = [];
  for (let offset = 0; offset < trendRange.rangeDays; offset += 1) {
    const date = startOfDay(new Date(trendRange.startDate));
    date.setDate(trendRange.startDate.getDate() + offset);
    const dateKey = buildDateKey(date);
    const stat = trendMap.get(dateKey);
    trend.push({
      date: dateKey,
      label: formatStatDate(date),
      totalNetAmount: toNumber(stat && stat.totalNetAmount),
      joinNetAmount: toNumber(stat && stat.joinNetAmount),
      renewalNetAmount: toNumber(stat && stat.renewalNetAmount),
      rewardNetAmount: toNumber(stat && stat.rewardNetAmount),
      questionNetAmount: toNumber(stat && stat.questionNetAmount),
    });
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        mode: "income",
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
        },
        filters: {
          startDate: String(input.startDate || ""),
          endDate: String(input.endDate || ""),
          rangeDays: trendRange.rangeDays,
        },
        summary: {
          totalIncome,
          weekIncome,
          lastWeekIncome,
          monthIncome,
          lastMonthIncome,
          yesterdayIncome,
          joinIncome,
          yesterdayJoinIncome,
          renewalIncome,
          yesterdayRenewalIncome,
          rewardIncome,
          yesterdayRewardIncome,
          questionIncome,
          yesterdayQuestionIncome,
          totalMembers,
          yesterdayJoinedCount,
          paidMembers,
          yesterdayPaidJoinedCount,
          monthRenewedCount,
          lastMonthRenewedCount,
          yesterdayRenewedCount,
        },
        trend,
        pagination: buildPagination(totalOrders, page, pageSize),
        items: orderRows.map((order) => ({
          id: order.id,
          orderNo: order.orderNo,
          paidAt: toIso(order.paidAt || order.createdAt),
          type: order.type,
          typeLabel: mapOrderType(order.type),
          nickname: profileOf(order.user).nickname || order.user.mobile || "微信用户",
          amount: formatMoney(order.amount),
          income: formatMoney(order.netAmount),
          status: order.status,
          statusLabel: mapOrderStatus(order.status, order.paymentStatus),
        })),
      },
    },
  };
}

async function getAdminRenewal(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;
  const dashboardAccess = ensureAdminViewerCapability(guard, "canViewDashboard", "当前角色未开启后台数据查看权限");
  if (dashboardAccess.error) {
    return dashboardAccess.error;
  }
  const incomeAccess = ensureAdminViewerCapability(guard, "canViewIncome", "当前角色未开启续期数据查看权限");
  if (incomeAccess.error) {
    return incomeAccess.error;
  }

  const trendRange = buildTrendRange(input);
  const reportDateWhere = buildReportDateWhere("paidAt", input);
  const page = parsePositiveInt(input.page, 1, 9999);
  const pageSize = parsePositiveInt(input.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const calendarRanges = buildIncomeCalendarRanges();
  const renewalMemberWhere = {
    groupId: group.id,
    isPaid: true,
    status: {
      in: ["ACTIVE", "EXPIRED"],
    },
  };
  const orderWhere = {
    groupId: group.id,
    type: "GROUP_RENEWAL",
    paymentStatus: "PAID",
  };

  if (reportDateWhere && reportDateWhere.paidAt) {
    orderWhere.paidAt = reportDateWhere.paidAt;
  }

  const expiredWithin7DaysStart = startOfDay(new Date(calendarRanges.todayStart));
  expiredWithin7DaysStart.setDate(expiredWithin7DaysStart.getDate() - 7);
  const advanceRenewableEnd = endOfDay(addCalendarMonths(calendarRanges.todayStart, 3));
  const futureExpireEnd = endOfDay(addCalendarMonths(calendarRanges.todayStart, 12));

  const [
    trendRows,
    allRenewalRows,
    totalRenewalOrders,
    renewalOrders,
    allRenewalPaidOrders,
    templates,
    settings,
    expiredOver7DaysCount,
    expiredWithin7DaysCount,
    advanceRenewableCount,
    upcomingExpireMembers,
  ] = await Promise.all([
    prisma.groupRenewalDailyStat.findMany({
      where: {
        groupId: group.id,
        statDate: {
          gte: trendRange.startDate,
          lte: trendRange.endDate,
        },
      },
      orderBy: {
        statDate: "asc",
      },
    }),
    prisma.groupRenewalDailyStat.findMany({
      where: {
        groupId: group.id,
      },
    }),
    prisma.order.count({
      where: orderWhere,
    }),
    prisma.order.findMany({
      where: orderWhere,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.findMany({
      where: {
        groupId: group.id,
        type: "GROUP_RENEWAL",
        paymentStatus: "PAID",
      },
      select: {
        userId: true,
        paidAt: true,
        createdAt: true,
      },
    }),
    prisma.renewalNotificationTemplate.findMany({
      where: {
        groupId: group.id,
      },
      orderBy: [{ expiredDays: "asc" }],
    }),
    findCompatibleRenewalSetting(group.id),
    prisma.groupMember.count({
      where: {
        ...renewalMemberWhere,
        expireAt: {
          lt: expiredWithin7DaysStart,
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        ...renewalMemberWhere,
        expireAt: {
          gte: expiredWithin7DaysStart,
          lt: calendarRanges.todayStart,
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        ...renewalMemberWhere,
        status: "ACTIVE",
        expireAt: {
          gte: calendarRanges.todayStart,
          lte: advanceRenewableEnd,
        },
      },
    }),
    prisma.groupMember.findMany({
      where: {
        ...renewalMemberWhere,
        status: "ACTIVE",
        expireAt: {
          gte: calendarRanges.todayStart,
          lte: futureExpireEnd,
        },
      },
      select: {
        expireAt: true,
      },
    }),
  ]);

  const totalRenewalIncome = allRenewalRows.reduce((sum, row) => sum + toNumber(row.renewalIncomeAmount), 0);
  const renewedCount = allRenewalRows.reduce((sum, row) => sum + toNumber(row.renewedCount), 0);
  const renewableCount = allRenewalRows.reduce((sum, row) => sum + toNumber(row.renewableCount), 0);
  const renewalPageVisitCount = allRenewalRows.reduce((sum, row) => sum + toNumber(row.renewalPageVisitCount), 0);
  const renewalPaySuccessCount = allRenewalRows.reduce((sum, row) => sum + toNumber(row.renewalPaySuccessCount), 0);
  const yesterdayRenewalIncome = sumDailyStatValue(
    allRenewalRows,
    calendarRanges.yesterdayStart,
    calendarRanges.yesterdayEnd,
    (row) => row.renewalIncomeAmount
  );
  const monthRenewalIncome = sumDailyStatValue(
    allRenewalRows,
    calendarRanges.currentMonthStart,
    calendarRanges.currentMonthEnd,
    (row) => row.renewalIncomeAmount
  );
  const lastMonthRenewalIncome = sumDailyStatValue(
    allRenewalRows,
    calendarRanges.lastMonthStart,
    calendarRanges.lastMonthEnd,
    (row) => row.renewalIncomeAmount
  );
  const yesterdayRenewedCount = sumDailyStatValue(
    allRenewalRows,
    calendarRanges.yesterdayStart,
    calendarRanges.yesterdayEnd,
    (row) => row.renewedCount
  );
  const monthRenewedCount = sumDailyStatValue(
    allRenewalRows,
    calendarRanges.currentMonthStart,
    calendarRanges.currentMonthEnd,
    (row) => row.renewedCount
  );
  const lastMonthRenewedCount = sumDailyStatValue(
    allRenewalRows,
    calendarRanges.lastMonthStart,
    calendarRanges.lastMonthEnd,
    (row) => row.renewedCount
  );
  const firstRenewalPaidAtByUser = new Map();
  allRenewalPaidOrders.forEach((order) => {
    const paidAt = order.paidAt || order.createdAt;
    if (!paidAt) {
      return;
    }

    const paidTime = new Date(paidAt).getTime();
    const previousPaidTime = firstRenewalPaidAtByUser.get(order.userId);
    if (!previousPaidTime || paidTime < previousPaidTime) {
      firstRenewalPaidAtByUser.set(order.userId, paidTime);
    }
  });
  const firstRenewedYesterdayCount = Array.from(firstRenewalPaidAtByUser.values()).reduce((sum, paidTime) => {
    return paidTime >= calendarRanges.yesterdayStart.getTime() && paidTime <= calendarRanges.yesterdayEnd.getTime()
      ? sum + 1
      : sum;
  }, 0);
  const expireTrend = buildFutureExpireBuckets(upcomingExpireMembers, calendarRanges.todayStart);

  const trendMap = new Map(trendRows.map((item) => [buildDateKey(item.statDate), item]));
  const trend = [];
  for (let offset = 0; offset < trendRange.rangeDays; offset += 1) {
    const date = startOfDay(new Date(trendRange.startDate));
    date.setDate(trendRange.startDate.getDate() + offset);
    const dateKey = buildDateKey(date);
    const stat = trendMap.get(dateKey);
    trend.push({
      date: dateKey,
      label: formatStatDate(date),
      renewalIncomeAmount: toNumber(stat && stat.renewalIncomeAmount),
      renewedCount: toNumber(stat && stat.renewedCount),
      renewableCount: toNumber(stat && stat.renewableCount),
      renewalPageVisitCount: toNumber(stat && stat.renewalPageVisitCount),
      renewalPaySuccessCount: toNumber(stat && stat.renewalPaySuccessCount),
      renewalConversionRate: toNumber(stat && stat.renewalConversionRate),
    });
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        mode: "renewal",
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
        },
        filters: {
          startDate: String(input.startDate || ""),
          endDate: String(input.endDate || ""),
          rangeDays: trendRange.rangeDays,
        },
        summary: {
          renewalIncomeAmount: totalRenewalIncome,
          renewedCount,
          renewableCount,
          renewalPageVisitCount,
          renewalPaySuccessCount,
          renewalConversionRate: formatRatio(renewalPaySuccessCount, renewalPageVisitCount),
          renewalPrice: settings ? formatMoney(settings.amount) : "0.00",
          renewalOriginalPrice: settings ? formatMoney(settings.originalAmount) : "0.00",
          renewalDiscountedPercentage: settings ? settings.discountedPercentage : 100,
          renewalGuidance: settings && settings.guidance ? settings.guidance : "待补充续期引导语",
          yesterdayRenewalIncome,
          monthRenewalIncome,
          lastMonthRenewalIncome,
          yesterdayRenewedCount,
          monthRenewedCount,
          lastMonthRenewedCount,
          totalRenewedMembers: firstRenewalPaidAtByUser.size,
          firstRenewedYesterdayCount,
        },
        breakdown: {
          expiredOver7DaysCount,
          expiredWithin7DaysCount,
          advanceRenewableCount,
        },
        expireTrend,
        trend,
        actions: [
          {
            action: "续期提醒",
            target: String(renewableCount),
            sent: String(templates.reduce((sum, item) => sum + toNumber(item.pushedCount), 0)),
            result: templates.length ? `已配置 ${templates.length} 条模板` : "待配置",
          },
          {
            action: "续期优惠",
            target: String(renewableCount),
            sent: settings ? `价格 ${formatMoney(settings.amount)}` : "0",
            result: settings ? `折扣 ${settings.discountedPercentage}%` : "待配置",
          },
        ],
        pagination: buildPagination(totalRenewalOrders, page, pageSize),
        items: renewalOrders.map((order) => ({
          id: order.id,
          orderNo: order.orderNo,
          paidAt: toIso(order.paidAt || order.createdAt),
          nickname: profileOf(order.user).nickname || order.user.mobile || "微信用户",
          amount: formatMoney(order.amount),
          income: formatMoney(order.netAmount),
          status: order.status,
          statusLabel: mapOrderStatus(order.status, order.paymentStatus),
        })),
      },
    },
  };
}

async function getAdminPromotion(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;
  const dashboardAccess = ensureAdminViewerCapability(guard, "canViewDashboard", "当前角色未开启后台数据查看权限");
  if (dashboardAccess.error) {
    return dashboardAccess.error;
  }
  const incomeAccess = ensureAdminViewerCapability(guard, "canViewIncome", "当前角色未开启推广数据查看权限");
  if (incomeAccess.error) {
    return incomeAccess.error;
  }

  const trendRange = buildTrendRange(input);
  const reportDateWhere = buildReportDateWhere("paidAt", input);
  const page = parsePositiveInt(input.page, 1, 9999);
  const pageSize = parsePositiveInt(input.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const calendarRanges = buildIncomeCalendarRanges();
  const paidJoinOrderWhere = {
    groupId: group.id,
    type: "GROUP_JOIN",
    paymentStatus: "PAID",
  };
  const reportOrderWhere = {
    ...paidJoinOrderWhere,
  };

  if (reportDateWhere && reportDateWhere.paidAt) {
    reportOrderWhere.paidAt = reportDateWhere.paidAt;
  }

  const [
    trendRows,
    allPromotionRows,
    allRenewalRows,
    channels,
    allPaidJoinOrders,
    totalOrders,
    orderRows,
    paidMembers,
    yesterdayPaidJoinedCount,
    monthPaidJoinedCount,
    lastMonthPaidJoinedCount,
    memberInvitedCount,
    yesterdayMemberInvitedCount,
  ] = await Promise.all([
    prisma.groupPromotionDailyStat.findMany({
      where: {
        groupId: group.id,
        statDate: {
          gte: trendRange.startDate,
          lte: trendRange.endDate,
        },
      },
      orderBy: {
        statDate: "asc",
      },
    }),
    prisma.groupPromotionDailyStat.findMany({
      where: {
        groupId: group.id,
      },
    }),
    prisma.groupRenewalDailyStat.findMany({
      where: {
        groupId: group.id,
      },
    }),
    prisma.promotionChannel.findMany({
      where: {
        groupId: group.id,
      },
      orderBy: [{ isEnabled: "desc" }, { createdAt: "asc" }],
    }),
    prisma.order.findMany({
      where: paidJoinOrderWhere,
      select: {
        amount: true,
        netAmount: true,
        paidAt: true,
        createdAt: true,
        promotionChannelId: true,
      },
    }),
    prisma.order.count({
      where: reportOrderWhere,
    }),
    prisma.order.findMany({
      where: reportOrderWhere,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        promotionChannel: true,
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        userId: {
          not: group.ownerUserId,
        },
        isPaid: true,
        status: {
          not: "QUIT",
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        userId: {
          not: group.ownerUserId,
        },
        isPaid: true,
        status: {
          not: "QUIT",
        },
        joinedAt: {
          gte: calendarRanges.yesterdayStart,
          lte: calendarRanges.yesterdayEnd,
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        userId: {
          not: group.ownerUserId,
        },
        isPaid: true,
        status: {
          not: "QUIT",
        },
        joinedAt: {
          gte: calendarRanges.currentMonthStart,
          lte: calendarRanges.currentMonthEnd,
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        userId: {
          not: group.ownerUserId,
        },
        isPaid: true,
        status: {
          not: "QUIT",
        },
        joinedAt: {
          gte: calendarRanges.lastMonthStart,
          lte: calendarRanges.lastMonthEnd,
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        joinSource: "INVITE",
        status: {
          not: "QUIT",
        },
      },
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        joinSource: "INVITE",
        status: {
          not: "QUIT",
        },
        joinedAt: {
          gte: calendarRanges.yesterdayStart,
          lte: calendarRanges.yesterdayEnd,
        },
      },
    }),
  ]);

  const previewVisitCount = allPromotionRows.reduce((sum, row) => sum + toNumber(row.previewVisitCount), 0);
  const clickJoinCount = allPromotionRows.reduce((sum, row) => sum + toNumber(row.clickJoinCount), 0);
  const paySuccessCount = allPaidJoinOrders.length;
  const paidJoinCount = allPaidJoinOrders.length;
  const joinIncomeAmount = allPaidJoinOrders.reduce((sum, order) => sum + toNumber(order.amount), 0);
  const joinIncome = allPaidJoinOrders.reduce((sum, order) => sum + toNumber(order.netAmount), 0);
  const yesterdayJoinIncome = sumOrderValue(
    allPaidJoinOrders,
    calendarRanges.yesterdayStart,
    calendarRanges.yesterdayEnd,
    (order) => order.netAmount
  );
  const weekJoinIncome = sumOrderValue(
    allPaidJoinOrders,
    calendarRanges.currentWeekStart,
    calendarRanges.currentWeekEnd,
    (order) => order.netAmount
  );
  const lastWeekJoinIncome = sumOrderValue(
    allPaidJoinOrders,
    calendarRanges.lastWeekStart,
    calendarRanges.lastWeekEnd,
    (order) => order.netAmount
  );
  const monthJoinIncome = sumOrderValue(
    allPaidJoinOrders,
    calendarRanges.currentMonthStart,
    calendarRanges.currentMonthEnd,
    (order) => order.netAmount
  );
  const lastMonthJoinIncome = sumOrderValue(
    allPaidJoinOrders,
    calendarRanges.lastMonthStart,
    calendarRanges.lastMonthEnd,
    (order) => order.netAmount
  );
  const monthRenewedCount = sumDailyStatValue(
    allRenewalRows,
    calendarRanges.currentMonthStart,
    calendarRanges.currentMonthEnd,
    (row) => row.renewedCount
  );
  const lastMonthRenewedCount = sumDailyStatValue(
    allRenewalRows,
    calendarRanges.lastMonthStart,
    calendarRanges.lastMonthEnd,
    (row) => row.renewedCount
  );

  const trendMap = new Map(trendRows.map((item) => [buildDateKey(item.statDate), item]));
  const paidJoinTrendMap = new Map();
  for (const order of allPaidJoinOrders) {
    const paidAt = resolvePaidOrderDate(order);
    if (!paidAt) {
      continue;
    }

    const dateKey = buildDateKey(paidAt);
    const current = paidJoinTrendMap.get(dateKey) || {
      paySuccessCount: 0,
      paidJoinCount: 0,
      joinIncomeAmount: 0,
    };
    current.paySuccessCount += 1;
    current.paidJoinCount += 1;
    current.joinIncomeAmount += toNumber(order.amount);
    paidJoinTrendMap.set(dateKey, current);
  }
  const trend = [];
  for (let offset = 0; offset < trendRange.rangeDays; offset += 1) {
    const date = startOfDay(new Date(trendRange.startDate));
    date.setDate(trendRange.startDate.getDate() + offset);
    const dateKey = buildDateKey(date);
    const stat = trendMap.get(dateKey);
    const paidJoinStat = paidJoinTrendMap.get(dateKey);
    trend.push({
      date: dateKey,
      label: formatStatDate(date),
      previewVisitCount: toNumber(stat && stat.previewVisitCount),
      clickJoinCount: toNumber(stat && stat.clickJoinCount),
      paySuccessCount: toNumber(paidJoinStat && paidJoinStat.paySuccessCount),
      paidJoinCount: toNumber(paidJoinStat && paidJoinStat.paidJoinCount),
      joinIncomeAmount: toNumber(paidJoinStat && paidJoinStat.joinIncomeAmount),
    });
  }

  const orderRowsByChannel = new Map();
  for (const item of allPaidJoinOrders) {
    const channelId = item.promotionChannelId || "__none__";
    const current = orderRowsByChannel.get(channelId) || { paid: 0, income: 0 };
    current.paid += 1;
    current.income += toNumber(item.netAmount);
    orderRowsByChannel.set(channelId, current);
  }

  const channelRows = channels.map((channel) => {
    const stats = orderRowsByChannel.get(channel.id) || { paid: 0, income: 0 };
    const visits = Math.max(stats.paid * 6, stats.paid ? stats.paid : 0);
    const clicks = Math.max(stats.paid * 2, stats.paid ? stats.paid : 0);
    return {
      id: channel.id,
      channel: channel.name,
      visits,
      clicks,
      paid: stats.paid,
      rate: formatRatio(stats.paid, visits),
      income: formatMoney(stats.income),
      isEnabled: channel.isEnabled,
    };
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        mode: "promotion",
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
        },
        filters: {
          startDate: String(input.startDate || ""),
          endDate: String(input.endDate || ""),
          rangeDays: trendRange.rangeDays,
        },
        summary: {
          previewVisitCount,
          clickJoinCount,
          paySuccessCount,
          paidJoinCount,
          joinIncomeAmount,
          joinIncome,
          yesterdayJoinIncome,
          weekJoinIncome,
          lastWeekJoinIncome,
          monthJoinIncome,
          lastMonthJoinIncome,
          paidMembers,
          yesterdayPaidJoinedCount,
          monthPaidJoinedCount,
          lastMonthPaidJoinedCount,
          memberInvitedCount,
          yesterdayMemberInvitedCount,
          monthRenewedCount,
          lastMonthRenewedCount,
          conversionRate: formatRatio(paySuccessCount, previewVisitCount),
          paySuccessRate: formatRatio(paySuccessCount, clickJoinCount),
        },
        funnel: {
          previewVisitCount,
          clickJoinCount,
          paySuccessCount,
          conversionRate: formatRatio(paySuccessCount, previewVisitCount),
        },
        trend,
        channelRows,
        pagination: buildPagination(totalOrders, page, pageSize),
        items: orderRows.map((order) => ({
          id: order.id,
          orderNo: order.orderNo,
          paidAt: toIso(order.paidAt || order.createdAt),
          channel: order.promotionChannel ? order.promotionChannel.name : "未归因",
          nickname: profileOf(order.user).nickname || order.user.mobile || "微信用户",
          amount: formatMoney(order.amount),
          income: formatMoney(order.netAmount),
          status: order.status,
          statusLabel: mapOrderStatus(order.status, order.paymentStatus),
        })),
      },
    },
  };
}

async function getAdminPromotionChannels(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;
  const dashboardAccess = ensureAdminViewerCapability(guard, "canViewDashboard", "当前角色未开启后台数据查看权限");
  if (dashboardAccess.error) {
    return dashboardAccess.error;
  }
  const incomeAccess = ensureAdminViewerCapability(guard, "canViewIncome", "当前角色未开启渠道推广数据查看权限");
  if (incomeAccess.error) {
    return incomeAccess.error;
  }

  const channels = await prisma.promotionChannel.findMany({
    where: {
      groupId: group.id,
    },
    orderBy: [{ isEnabled: "desc" }, { createdAt: "asc" }],
    include: {
      orders: {
        where: {
          paymentStatus: "PAID",
        },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      },
    },
  });

  const hydratedChannels = await Promise.all(
    channels.map(async (channel) => {
      try {
        const qrCodeUrl = await ensurePromotionChannelMiniCode(channel);
        return {
          ...channel,
          qrCodeUrl: qrCodeUrl || channel.qrCodeUrl || "",
        };
      } catch (error) {
        return channel;
      }
    })
  );

  const rows = hydratedChannels.map((channel) => serializeAdminPromotionChannelRow(channel, group));

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
        },
        rows,
      },
    },
  };
}

async function createAdminPromotionChannel(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }

  const group = guard.group;
  const dashboardAccess = ensureAdminViewerCapability(guard, "canViewDashboard", "当前角色未开启后台数据查看权限");
  if (dashboardAccess.error) {
    return dashboardAccess.error;
  }
  const incomeAccess = ensureAdminViewerCapability(guard, "canViewIncome", "当前角色未开启渠道推广数据查看权限");
  if (incomeAccess.error) {
    return incomeAccess.error;
  }

  const name = normalizePromotionChannelName(input.name);
  const validationMessage = validatePromotionChannelName(name);
  if (validationMessage) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: validationMessage,
      },
    };
  }

  const code = await generatePromotionChannelCode(name);
  const createdChannel = await prisma.promotionChannel.create({
    data: {
      groupId: group.id,
      name,
      code,
      isEnabled: true,
      qrCodeUrl: "",
    },
    include: {
      orders: {
        where: {
          paymentStatus: "PAID",
        },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      },
    },
  });

  const qrCodeUrl = await ensurePromotionChannelMiniCode(createdChannel).catch(() => createdChannel.qrCodeUrl || "");
  const hydratedChannel = {
    ...createdChannel,
    qrCodeUrl,
  };

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        row: serializeAdminPromotionChannelRow(hydratedChannel, group),
      },
    },
  };
}

function buildCouponStatusLabel(status) {
  return status === "ACTIVE"
    ? "生效中"
    : status === "DRAFT"
      ? "草稿"
      : status === "PAUSED"
        ? "已暂停"
        : status === "EXPIRED"
          ? "已过期"
          : "已归档";
}

function buildCouponTypeLabel(type) {
  return type === "PROMOTION" ? "拉新券" : type === "RENEWAL" ? "续期券" : "其他";
}

function normalizeCouponType(value) {
  const type = String(value || "").trim().toUpperCase();
  return type === "PROMOTION" || type === "RENEWAL" ? type : "";
}

function normalizeCouponEditableStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  return status === "DRAFT" || status === "ACTIVE" || status === "PAUSED" ? status : "";
}

function parseCouponAmountInput(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return amount;
}

function parseCouponQuantityInput(value) {
  if (value === "" || value === null || value === undefined) {
    return 0;
  }

  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 0) {
    return null;
  }

  return quantity;
}

function parseCouponDateInput(value, isEnd = false) {
  const parsed = parseDateOnly(value);
  if (!parsed) {
    return null;
  }

  return isEnd ? endOfDay(parsed) : startOfDay(parsed);
}

function normalizeRenewalNoticeRouteKey(value) {
  const routeKey = String(value || "").trim();
  if (!routeKey) {
    return "";
  }

  return routeKey === "renewal-page" || routeKey === "renewal-recall" ? routeKey : "";
}

function buildRenewalNoticeStatusLabel(status) {
  return status === "SENT"
    ? "已发送"
    : status === "SCHEDULED"
      ? "已排期"
      : status === "DRAFT"
        ? "草稿"
        : "已取消";
}

function serializeAdminRenewalNotice(notice) {
  return {
    id: notice.id,
    title: notice.title || "未命名通知",
    content: notice.content,
    buttonText: notice.buttonText || "",
    buttonUrl: notice.buttonUrl || "",
    routeKey: notice.routeKey || "",
    status: notice.status,
    statusLabel: buildRenewalNoticeStatusLabel(notice.status),
    scheduledAt: toIso(notice.scheduledAt),
    sentAt: toIso(notice.sentAt),
    pushedCount: notice.pushedCount,
  };
}

function serializeAdminCoupon(coupon) {
  return {
    id: coupon.id,
    type: coupon.type,
    typeLabel: buildCouponTypeLabel(coupon.type),
    name: coupon.name,
    code: coupon.code,
    amount: formatMoney(coupon.amount),
    totalQuantity: coupon.totalQuantity || 0,
    usedQuantity: coupon.usedQuantity,
    visitCount: coupon.visitCount,
    status: coupon.status,
    statusLabel: buildCouponStatusLabel(coupon.status),
    validFrom: toIso(coupon.validFrom),
    validTo: toIso(coupon.validTo),
  };
}

async function listAdminCoupons(groupId, couponType) {
  const where = {
    groupId,
  };

  if (couponType) {
    where.type = couponType;
  }

  const coupons = await prisma.coupon.findMany({
    where,
    orderBy: [{ type: "asc" }, { status: "asc" }, { createdAt: "desc" }],
  });

  return coupons.map(serializeAdminCoupon);
}

async function getAdminCoupons(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;

  const couponType = input.couponType === "PROMOTION" || input.couponType === "RENEWAL" ? input.couponType : "";
  const rows = await listAdminCoupons(group.id, couponType);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
        },
        rows,
      },
    },
  };
}

async function getAdminRenewalCoupons(input = {}) {
  return getAdminCoupons({
    ...input,
    couponType: "RENEWAL",
  });
}

async function createAdminCoupon(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }

  const group = guard.group;
  const type = normalizeCouponType(input.type);
  const status = input.status === undefined || input.status === null || String(input.status).trim() === ""
    ? ""
    : normalizeCouponEditableStatus(input.status);
  const name = String(input.name || "").trim();
  const code = String(input.code || "").trim();
  const amount = parseCouponAmountInput(input.amount);
  const totalQuantity = parseCouponQuantityInput(input.totalQuantity);
  const validFrom = input.validFrom ? parseCouponDateInput(input.validFrom) : null;
  const validTo = input.validTo ? parseCouponDateInput(input.validTo, true) : null;

  if (!type) {
    return { statusCode: 400, payload: { ok: false, message: "优惠券类型不合法" } };
  }

  if (input.status !== undefined && input.status !== null && String(input.status).trim() !== "" && !status) {
    return { statusCode: 400, payload: { ok: false, message: "优惠券状态不合法" } };
  }

  if (!name) {
    return { statusCode: 400, payload: { ok: false, message: "请填写优惠券名称" } };
  }

  if (!code) {
    return { statusCode: 400, payload: { ok: false, message: "请填写优惠券编码" } };
  }

  if (amount === null) {
    return { statusCode: 400, payload: { ok: false, message: "优惠金额必须是大于等于 0 的数字" } };
  }

  if (totalQuantity === null) {
    return { statusCode: 400, payload: { ok: false, message: "库存数量必须是大于等于 0 的整数" } };
  }

  if (input.validFrom && !validFrom) {
    return { statusCode: 400, payload: { ok: false, message: "生效时间格式不正确" } };
  }

  if (input.validTo && !validTo) {
    return { statusCode: 400, payload: { ok: false, message: "到期时间格式不正确" } };
  }

  if (validFrom && validTo && validTo.getTime() < validFrom.getTime()) {
    return { statusCode: 400, payload: { ok: false, message: "到期时间不能早于生效时间" } };
  }

  if (status === "ACTIVE" && validTo && validTo.getTime() < Date.now()) {
    return { statusCode: 400, payload: { ok: false, message: "当前优惠券已过期，请先调整有效期后再上线" } };
  }

  const existingCodeCoupon = await prisma.coupon.findUnique({
    where: { code },
    select: { id: true },
  });

  if (existingCodeCoupon) {
    return { statusCode: 400, payload: { ok: false, message: "优惠券编码已存在，请更换后重试" } };
  }

  const coupon = await prisma.coupon.create({
    data: {
      groupId: group.id,
      type,
      name,
      code,
      amount,
      totalQuantity,
      validFrom,
      validTo,
      status: status || "DRAFT",
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        row: serializeAdminCoupon(coupon),
      },
    },
  };
}

async function updateAdminCoupon(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }

  const couponId = String(input.id || "").trim();
  if (!couponId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少优惠券 ID" } };
  }

  const existingCoupon = await prisma.coupon.findFirst({
    where: {
      id: couponId,
      groupId: guard.group.id,
    },
  });

  if (!existingCoupon) {
    return { statusCode: 404, payload: { ok: false, message: "优惠券不存在" } };
  }

  const type = normalizeCouponType(input.type);
  const hasStatusInput = input.status !== undefined && input.status !== null && String(input.status).trim() !== "";
  const status = hasStatusInput ? normalizeCouponEditableStatus(input.status) : "";
  const name = String(input.name || "").trim();
  const code = String(input.code || "").trim();
  const amount = parseCouponAmountInput(input.amount);
  const totalQuantity = parseCouponQuantityInput(input.totalQuantity);
  const validFrom = input.validFrom ? parseCouponDateInput(input.validFrom) : null;
  const validTo = input.validTo ? parseCouponDateInput(input.validTo, true) : null;

  if (!type) {
    return { statusCode: 400, payload: { ok: false, message: "优惠券类型不合法" } };
  }

  if (hasStatusInput && !status) {
    return { statusCode: 400, payload: { ok: false, message: "优惠券状态不合法" } };
  }

  if (!name) {
    return { statusCode: 400, payload: { ok: false, message: "请填写优惠券名称" } };
  }

  if (!code) {
    return { statusCode: 400, payload: { ok: false, message: "请填写优惠券编码" } };
  }

  if (amount === null) {
    return { statusCode: 400, payload: { ok: false, message: "优惠金额必须是大于等于 0 的数字" } };
  }

  if (totalQuantity === null) {
    return { statusCode: 400, payload: { ok: false, message: "库存数量必须是大于等于 0 的整数" } };
  }

  if (totalQuantity < existingCoupon.usedQuantity) {
    return { statusCode: 400, payload: { ok: false, message: "库存数量不能小于已使用数量" } };
  }

  if (input.validFrom && !validFrom) {
    return { statusCode: 400, payload: { ok: false, message: "生效时间格式不正确" } };
  }

  if (input.validTo && !validTo) {
    return { statusCode: 400, payload: { ok: false, message: "到期时间格式不正确" } };
  }

  if (validFrom && validTo && validTo.getTime() < validFrom.getTime()) {
    return { statusCode: 400, payload: { ok: false, message: "到期时间不能早于生效时间" } };
  }

  if (status === "ACTIVE" && validTo && validTo.getTime() < Date.now()) {
    return { statusCode: 400, payload: { ok: false, message: "当前优惠券已过期，请先调整有效期后再上线" } };
  }

  const existingCodeCoupon = await prisma.coupon.findUnique({
    where: { code },
    select: { id: true },
  });

  if (existingCodeCoupon && existingCodeCoupon.id !== existingCoupon.id) {
    return { statusCode: 400, payload: { ok: false, message: "优惠券编码已存在，请更换后重试" } };
  }

  const coupon = await prisma.coupon.update({
    where: { id: existingCoupon.id },
    data: {
      type,
      name,
      code,
      amount,
      totalQuantity,
      validFrom,
      validTo,
      ...(hasStatusInput ? { status } : {}),
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        row: serializeAdminCoupon(coupon),
      },
    },
  };
}

async function updateAdminCouponStatus(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }

  const couponId = String(input.id || "").trim();
  const status = normalizeCouponEditableStatus(input.status);

  if (!couponId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少优惠券 ID" } };
  }

  if (!status) {
    return { statusCode: 400, payload: { ok: false, message: "优惠券状态不合法" } };
  }

  const existingCoupon = await prisma.coupon.findFirst({
    where: {
      id: couponId,
      groupId: guard.group.id,
    },
  });

  if (!existingCoupon) {
    return { statusCode: 404, payload: { ok: false, message: "优惠券不存在" } };
  }

  if (status === "ACTIVE" && existingCoupon.validTo && existingCoupon.validTo.getTime() < Date.now()) {
    return { statusCode: 400, payload: { ok: false, message: "当前优惠券已过期，请先调整有效期后再上线" } };
  }

  const coupon = await prisma.coupon.update({
    where: { id: existingCoupon.id },
    data: {
      status,
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        row: serializeAdminCoupon(coupon),
      },
    },
  };
}

async function createAdminRenewalNotice(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }

  const group = guard.group;
  const title = String(input.title || "").trim();
  const content = String(input.content || "").trim();
  const buttonText = String(input.buttonText || "").trim();
  const buttonUrl = String(input.buttonUrl || "").trim();
  const routeKey = normalizeRenewalNoticeRouteKey(input.routeKey);

  if (!title) {
    return { statusCode: 400, payload: { ok: false, message: "请填写通知标题" } };
  }

  if (!content) {
    return { statusCode: 400, payload: { ok: false, message: "请填写推送内容" } };
  }

  if (content.length > 300) {
    return { statusCode: 400, payload: { ok: false, message: "推送内容不能超过 300 个字" } };
  }

  if (buttonText.length > 20) {
    return { statusCode: 400, payload: { ok: false, message: "按钮文案不能超过 20 个字" } };
  }

  if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl)) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "按钮文案和按钮跳转链接需要同时填写",
      },
    };
  }

  if (String(input.routeKey || "").trim() && !routeKey) {
    return { statusCode: 400, payload: { ok: false, message: "目标页面配置不合法" } };
  }

  const notice = await prisma.groupNotification.create({
    data: {
      groupId: group.id,
      title,
      content,
      buttonText: buttonText || null,
      buttonUrl: buttonUrl || null,
      routeKey: routeKey || null,
      status: "DRAFT",
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        row: serializeAdminRenewalNotice(notice),
      },
    },
  };
}

async function getAdminRenewalNotices(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;

  const notices = await prisma.groupNotification.findMany({
    where: {
      groupId: group.id,
    },
    orderBy: [{ status: "asc" }, { scheduledAt: "asc" }, { createdAt: "desc" }],
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
        },
        rows: notices.map(serializeAdminRenewalNotice),
      },
    },
  };
}

function buildDiscountPercent(amount, originalAmount) {
  const original = toNumber(originalAmount);
  if (original <= 0) {
    return 100;
  }

  return Math.round((toNumber(amount) / original) * 100);
}

function buildDiscountAmount(originalAmount, discountValue) {
  const base = toNumber(originalAmount);
  const ratio = toNumber(discountValue);
  if (base <= 0 || ratio <= 0) {
    return 0;
  }

  return Number(((base * ratio) / 10).toFixed(2));
}

function normalizeRenewalGuidanceInput(value) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n");

  if (normalized.length > 300) {
    return {
      error: {
        statusCode: 400,
        payload: {
          ok: false,
          message: "续期引导语不能超过 300 个字符",
        },
      },
    };
  }

  return {
    value: normalized,
  };
}

function normalizeRenewalSettingPayload(group, setting) {
  const originalAmount = setting ? setting.originalAmount : group.originalPriceAmount;
  const amount = setting ? setting.amount : group.priceAmount;
  const advanceAmount = setting ? setting.advanceAmount : amount;
  const graceAmount = setting ? setting.graceAmount : amount;

  return {
    group: {
      id: group.id,
      name: group.name,
      ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
    },
    setting: {
      enabled: setting ? setting.enabled !== false : true,
      limitWindow: setting ? setting.limitWindow === true : false,
      amount: formatMoney(amount),
      originalAmount: formatMoney(originalAmount),
      discountedPercentage: setting ? setting.discountedPercentage : buildDiscountPercent(amount, originalAmount),
      expiringEnabled: setting ? setting.expiringEnabled !== false : true,
      advanceAmount: formatMoney(advanceAmount),
      advanceDiscountPercentage: setting
        ? setting.advanceDiscountPercentage
        : buildDiscountPercent(advanceAmount, originalAmount),
      advanceEnabled: setting ? setting.advanceEnabled !== false : true,
      graceAmount: formatMoney(graceAmount),
      graceDiscountPercentage: setting
        ? setting.graceDiscountPercentage
        : buildDiscountPercent(graceAmount, originalAmount),
      graceEnabled: setting ? setting.graceEnabled !== false : true,
      audience:
        setting && RENEWAL_DISCOUNT_AUDIENCE_KEYS.includes(String(setting.audience || ""))
          ? setting.audience
          : "renewable_members",
      stackWithCoupon: setting ? setting.allowCouponStack !== false : true,
      minRenewCount: setting ? setting.minRenewCount || 0 : 0,
      mode: setting && setting.mode ? setting.mode : "period",
      duration: setting && setting.duration ? setting.duration : "1Y",
      beginTime: toIso(setting && setting.beginTime),
      startDate: formatDateOnly(setting && setting.beginTime),
      endTime: toIso(setting && setting.endTime),
      endDate: formatDateOnly(setting && setting.endTime),
      guidance: setting && typeof setting.guidance === "string" ? setting.guidance : "",
      renewalUrl: setting && typeof setting.renewalUrl === "string" ? setting.renewalUrl : "",
    },
  };
}

async function getAdminRenewalSettings(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;

  const setting = await findCompatibleRenewalSetting(group.id);

  const originalAmount = setting ? setting.originalAmount : group.originalPriceAmount;
  const amount = setting ? setting.amount : group.priceAmount;
  const advanceAmount = setting ? setting.advanceAmount : amount;
  const graceAmount = setting ? setting.graceAmount : amount;
  const settingSnapshot = setting
    ? { ...setting, originalAmount, amount, advanceAmount, graceAmount }
    : { originalAmount, amount, advanceAmount, graceAmount };

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: normalizeRenewalSettingPayload(group, settingSnapshot),
    },
  };
}

async function updateAdminRenewalSettings(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;

  const enabled = parseBooleanFlag(input.enabled, true);
  const limitWindow = parseBooleanFlag(input.limitWindow, false);
  const stackWithCoupon = parseBooleanFlag(input.stackWithCoupon, true);
  const audience = String(input.audience || "").trim() || "renewable_members";
  const minRenewCount = Number(input.minRenewCount);
  const basePriceText = String(input.basePrice ?? "").trim();
  const stages = Array.isArray(input.stages) ? input.stages : [];

  if (!RENEWAL_DISCOUNT_AUDIENCE_KEYS.includes(audience)) {
    return { statusCode: 400, payload: { ok: false, message: "命中人群配置不合法" } };
  }

  if (!Number.isInteger(minRenewCount) || minRenewCount < 0) {
    return { statusCode: 400, payload: { ok: false, message: "最低连续续费次数必须是大于等于 0 的整数" } };
  }

  if (!basePriceText) {
    return { statusCode: 400, payload: { ok: false, message: "续期原价不能为空" } };
  }

  const originalAmount = Number(basePriceText);
  if (!Number.isFinite(originalAmount) || originalAmount < 0) {
    return { statusCode: 400, payload: { ok: false, message: "续期原价必须是大于等于 0 的数字" } };
  }

  const normalizedStageMap = {};
  for (const key of RENEWAL_DISCOUNT_STAGE_KEYS) {
    const stage = stages.find((item) => item && item.key === key);
    if (!stage) {
      return { statusCode: 400, payload: { ok: false, message: "续期折扣阶段配置不完整" } };
    }

    const discountValue = Number(stage.discount);
    if (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 10) {
      return { statusCode: 400, payload: { ok: false, message: "折扣档位必须在 0 到 10 之间" } };
    }

    normalizedStageMap[key] = {
      enabled: parseBooleanFlag(stage.enabled, true),
      discountValue,
      amount: buildDiscountAmount(originalAmount, discountValue),
    };
  }

  if (normalizedStageMap.grace.amount < normalizedStageMap.advance.amount) {
    return { statusCode: 400, payload: { ok: false, message: "宽限召回价不能低于提前续期价" } };
  }

  let beginTime = null;
  let endTime = null;

  if (limitWindow) {
    const parsedStartDate = parseDateOnly(input.startDate);
    const parsedEndDate = parseDateOnly(input.endDate);

    if (!parsedStartDate || !parsedEndDate) {
      return { statusCode: 400, payload: { ok: false, message: "请补齐折扣生效时间范围" } };
    }

    if (parsedEndDate.getTime() < parsedStartDate.getTime()) {
      return { statusCode: 400, payload: { ok: false, message: "结束时间不能早于开始时间" } };
    }

    beginTime = startOfDay(parsedStartDate);
    endTime = endOfDay(parsedEndDate);
  }

  const writeCompatibility = await ensureRenewalSettingWriteCompatibility();
  if (writeCompatibility.error) {
    return writeCompatibility.error;
  }

  const existing = await findCompatibleRenewalSetting(group.id);
  const guidanceInput =
    input.guidance !== undefined
      ? normalizeRenewalGuidanceInput(input.guidance)
      : { value: existing && typeof existing.guidance === "string" ? existing.guidance : "" };

  if (guidanceInput.error) {
    return guidanceInput.error;
  }

  const updated = await prisma.renewalSetting.upsert({
    where: {
      groupId: group.id,
    },
    update: {
      enabled,
      limitWindow,
      amount: normalizedStageMap.expiring.amount,
      originalAmount,
      discountedPercentage: buildDiscountPercent(normalizedStageMap.expiring.amount, originalAmount),
      expiringEnabled: normalizedStageMap.expiring.enabled,
      advanceAmount: normalizedStageMap.advance.amount,
      advanceDiscountPercentage: buildDiscountPercent(normalizedStageMap.advance.amount, originalAmount),
      advanceEnabled: normalizedStageMap.advance.enabled,
      graceAmount: normalizedStageMap.grace.amount,
      graceDiscountPercentage: buildDiscountPercent(normalizedStageMap.grace.amount, originalAmount),
      graceEnabled: normalizedStageMap.grace.enabled,
      audience,
      allowCouponStack: stackWithCoupon,
      minRenewCount,
      beginTime,
      endTime,
      guidance: guidanceInput.value,
    },
    create: {
      groupId: group.id,
      enabled,
      limitWindow,
      amount: normalizedStageMap.expiring.amount,
      originalAmount,
      discountedPercentage: buildDiscountPercent(normalizedStageMap.expiring.amount, originalAmount),
      expiringEnabled: normalizedStageMap.expiring.enabled,
      advanceAmount: normalizedStageMap.advance.amount,
      advanceDiscountPercentage: buildDiscountPercent(normalizedStageMap.advance.amount, originalAmount),
      advanceEnabled: normalizedStageMap.advance.enabled,
      graceAmount: normalizedStageMap.grace.amount,
      graceDiscountPercentage: buildDiscountPercent(normalizedStageMap.grace.amount, originalAmount),
      graceEnabled: normalizedStageMap.grace.enabled,
      audience,
      allowCouponStack: stackWithCoupon,
      minRenewCount,
      mode: existing && existing.mode ? existing.mode : "period",
      duration: existing && existing.duration ? existing.duration : "1Y",
      beginTime,
      endTime,
      guidance: guidanceInput.value,
      renewalUrl: existing && typeof existing.renewalUrl === "string" ? existing.renewalUrl : "",
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: normalizeRenewalSettingPayload(group, updated),
    },
  };
}

async function updateAdminRenewalGuidance(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;

  const guidanceInput = normalizeRenewalGuidanceInput(input.guidance);
  if (guidanceInput.error) {
    return guidanceInput.error;
  }

  const writeCompatibility = await ensureRenewalSettingWriteCompatibility();
  if (writeCompatibility.error) {
    return writeCompatibility.error;
  }

  const existing = await findCompatibleRenewalSetting(group.id);

  const originalAmount = existing ? existing.originalAmount : group.originalPriceAmount;
  const amount = existing ? existing.amount : group.priceAmount;
  const advanceAmount = existing ? existing.advanceAmount : amount;
  const graceAmount = existing ? existing.graceAmount : amount;

  const updated = await prisma.renewalSetting.upsert({
    where: {
      groupId: group.id,
    },
    update: {
      guidance: guidanceInput.value,
    },
    create: {
      groupId: group.id,
      enabled: existing ? existing.enabled !== false : true,
      limitWindow: existing ? existing.limitWindow === true : false,
      amount,
      originalAmount,
      discountedPercentage: existing ? existing.discountedPercentage : buildDiscountPercent(amount, originalAmount),
      expiringEnabled: existing ? existing.expiringEnabled !== false : true,
      advanceAmount,
      advanceDiscountPercentage: existing
        ? existing.advanceDiscountPercentage
        : buildDiscountPercent(advanceAmount, originalAmount),
      advanceEnabled: existing ? existing.advanceEnabled !== false : true,
      graceAmount,
      graceDiscountPercentage: existing
        ? existing.graceDiscountPercentage
        : buildDiscountPercent(graceAmount, originalAmount),
      graceEnabled: existing ? existing.graceEnabled !== false : true,
      audience:
        existing && RENEWAL_DISCOUNT_AUDIENCE_KEYS.includes(String(existing.audience || ""))
          ? existing.audience
          : "renewable_members",
      allowCouponStack: existing ? existing.allowCouponStack !== false : true,
      minRenewCount: existing ? existing.minRenewCount || 0 : 0,
      mode: existing && existing.mode ? existing.mode : "period",
      duration: existing && existing.duration ? existing.duration : "1Y",
      beginTime: existing ? existing.beginTime : null,
      endTime: existing ? existing.endTime : null,
      guidance: guidanceInput.value,
      renewalUrl: existing && typeof existing.renewalUrl === "string" ? existing.renewalUrl : "",
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: normalizeRenewalSettingPayload(group, updated),
    },
  };
}

async function getAdminPaywallHighlights(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }

  const viewerAccess = ensureAdminViewerCapability(guard, "canViewDashboard", "当前角色未开启后台查看权限");
  if (viewerAccess.error) {
    return viewerAccess.error;
  }

  const group = guard.group;
  const store = readPaywallHighlightStore();
  const snapshot = store[group.id] && typeof store[group.id] === "object" ? store[group.id] : {};
  const images = Array.isArray(snapshot.images)
    ? snapshot.images.map((item, index) => normalizePaywallHighlightImage(item, index)).filter(Boolean)
    : [];

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
        },
        images,
        updatedAt: typeof snapshot.updatedAt === "string" ? snapshot.updatedAt : "",
      },
    },
  };
}

async function updateAdminPaywallHighlights(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }

  const viewerAccess = ensureAdminViewerCapability(guard, "canViewDashboard", "当前角色未开启后台查看权限");
  if (viewerAccess.error) {
    return viewerAccess.error;
  }

  const group = guard.group;
  const rawImages = Array.isArray(input.images) ? input.images : [];

  if (rawImages.length > 4) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "最多只能保存 4 张亮点图片",
      },
    };
  }

  const images = [];
  for (let index = 0; index < rawImages.length; index += 1) {
    const normalizedImage = normalizePaywallHighlightImage(rawImages[index], index);
    if (!normalizedImage) {
      return {
        statusCode: 400,
        payload: {
          ok: false,
          message: `第 ${index + 1} 张亮点图片格式不合法`,
        },
      };
    }
    images.push(normalizedImage);
  }

  const store = readPaywallHighlightStore();
  if (images.length) {
    store[group.id] = {
      images,
      updatedAt: new Date().toISOString(),
    };
  } else {
    delete store[group.id];
  }
  writePaywallHighlightStore(store);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
        },
        images,
        updatedAt: images.length && store[group.id] ? store[group.id].updatedAt : "",
      },
    },
  };
}

async function getAdminPermissions(input = {}) {
  const guard = await ensureAdminGroupContext(input);
  if (guard.error) {
    return guard.error;
  }
  const group = guard.group;
  const viewer = buildAdminViewer(guard);

  const [staffRows, memberCount] = await Promise.all([
    prisma.groupStaff.findMany({
      where: {
        groupId: group.id,
        isActive: true,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.groupMember.count({
      where: {
        groupId: group.id,
        status: "ACTIVE",
      },
    }),
  ]);

  const policy = group.permissionPolicy;
  const dedupedStaffRows = staffRows.filter((staff) => staff.userId !== group.ownerUserId);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
          memberCount,
        },
        viewer,
        roles: [
          {
            id: `owner_${group.ownerUserId}`,
            userId: group.ownerUserId,
            nickname: group.owner && group.owner.profile ? group.owner.profile.nickname : "星主",
            role: "OWNER",
            roleLabel: "星主",
            isActive: true,
          },
        ].concat(
          dedupedStaffRows.map((staff) => {
            const profile = profileOf(staff.user);
            const labelMap = {
              PARTNER: "合伙人",
              ADMIN: "管理员",
              OPERATOR: "运营",
            };
            return {
              id: staff.id,
              userId: staff.userId,
              nickname: profile.nickname || "微信用户",
              role: staff.role,
              roleLabel: labelMap[staff.role] || staff.role,
              isActive: staff.isActive,
            };
          })
        ),
        permissions: {
          dashboard: {
            partner: policy ? policy.partnerCanViewDashboard : true,
            admin: policy ? policy.adminCanViewDashboard : true,
          },
          income: {
            partner: policy ? policy.partnerCanViewIncome : true,
            admin: policy ? policy.adminCanViewIncome : true,
          },
          memberContact: {
            partner: policy ? policy.partnerCanViewMemberContact : true,
            admin: policy ? policy.adminCanViewMemberContact : true,
          },
          weeklyReport: {
            partner: policy ? policy.partnerCanViewWeeklyReport : true,
            admin: policy ? policy.adminCanViewWeeklyReport : true,
          },
        },
        payments: {
          allowStarCoinJoin: policy ? policy.allowStarCoinJoin : false,
          allowStarCoinRenewal: policy ? policy.allowStarCoinRenewal : false,
          allowVirtualPayJoin: policy ? policy.allowVirtualPayJoin : false,
          allowVirtualPayRenewal: policy ? policy.allowVirtualPayRenewal : false,
        },
        joinSettings: {
          allowJoin: policy ? policy.allowJoin : true,
          needExamine: policy ? policy.needExamine : false,
          allowPreview: policy ? policy.allowPreview : true,
          allowSearch: policy ? policy.allowSearch : true,
        },
      },
    },
  };
}

async function updateAdminPermissions(input = {}) {
  const groupId = String(input.groupId || "").trim();
  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const guard = await ensureGroupManager(groupId, input.sessionToken);
  if (guard.error) {
    return guard.error;
  }

  if (!guard.isOwner) {
    return { statusCode: 403, payload: { ok: false, message: "只有星主可以修改权限设置" } };
  }

  await prisma.groupPermissionPolicy.upsert({
    where: { groupId },
    update: {
      partnerCanViewDashboard: normalizeBoolean(input.dashboardPartner, true),
      adminCanViewDashboard: normalizeBoolean(input.dashboardAdmin, true),
      partnerCanViewIncome: normalizeBoolean(input.incomePartner, true),
      adminCanViewIncome: normalizeBoolean(input.incomeAdmin, true),
      partnerCanViewMemberContact: normalizeBoolean(input.memberContactPartner, true),
      adminCanViewMemberContact: normalizeBoolean(input.memberContactAdmin, true),
      partnerCanViewWeeklyReport: normalizeBoolean(input.weeklyReportPartner, true),
      adminCanViewWeeklyReport: normalizeBoolean(input.weeklyReportAdmin, true),
      allowStarCoinJoin: normalizeBoolean(input.allowStarCoinJoin, false),
      allowStarCoinRenewal: normalizeBoolean(input.allowStarCoinRenewal, false),
      allowVirtualPayJoin: normalizeBoolean(input.allowVirtualPayJoin, false),
      allowVirtualPayRenewal: normalizeBoolean(input.allowVirtualPayRenewal, false),
      allowJoin: normalizeBoolean(input.allowJoin, true),
      needExamine: normalizeBoolean(input.needExamine, false),
      allowPreview: normalizeBoolean(input.allowPreview, true),
      allowSearch: normalizeBoolean(input.allowSearch, true),
    },
    create: {
      groupId,
      partnerCanViewDashboard: normalizeBoolean(input.dashboardPartner, true),
      adminCanViewDashboard: normalizeBoolean(input.dashboardAdmin, true),
      partnerCanViewIncome: normalizeBoolean(input.incomePartner, true),
      adminCanViewIncome: normalizeBoolean(input.incomeAdmin, true),
      partnerCanViewMemberContact: normalizeBoolean(input.memberContactPartner, true),
      adminCanViewMemberContact: normalizeBoolean(input.memberContactAdmin, true),
      partnerCanViewWeeklyReport: normalizeBoolean(input.weeklyReportPartner, true),
      adminCanViewWeeklyReport: normalizeBoolean(input.weeklyReportAdmin, true),
      allowStarCoinJoin: normalizeBoolean(input.allowStarCoinJoin, false),
      allowStarCoinRenewal: normalizeBoolean(input.allowStarCoinRenewal, false),
      allowVirtualPayJoin: normalizeBoolean(input.allowVirtualPayJoin, false),
      allowVirtualPayRenewal: normalizeBoolean(input.allowVirtualPayRenewal, false),
      allowJoin: normalizeBoolean(input.allowJoin, true),
      needExamine: normalizeBoolean(input.needExamine, false),
      allowPreview: normalizeBoolean(input.allowPreview, true),
      allowSearch: normalizeBoolean(input.allowSearch, true),
    },
  });

  return getAdminPermissions({ groupId, sessionToken: input.sessionToken });
}

async function updateAdminContent(input = {}) {
  const postId = String(input.postId || "").trim();
  if (!postId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子ID" } };
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

  if (!existingPost) {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  const guard = await ensureGroupManager(existingPost.groupId, input.sessionToken);
  if (guard.error) {
    return guard.error;
  }
  const viewerAccess = ensureAdminViewerCapability(guard, "canManageContent", "当前角色仅可查看内容数据，不能修改内容状态");
  if (viewerAccess.error) {
    return viewerAccess.error;
  }

  const metadata = parseMetadata(existingPost.metadata);
  if (input.columnId !== undefined) {
    const nextColumnId = String(input.columnId || "").trim();

    if (nextColumnId) {
      const targetColumn = await prisma.column.findFirst({
        where: {
          id: nextColumnId,
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

      metadata.columnId = targetColumn.id;
      metadata.columnTitle = targetColumn.title;
    } else {
      delete metadata.columnId;
      delete metadata.columnTitle;
    }
  }

  if (input.reviewStatus !== undefined) {
    const nextReviewStatus = String(input.reviewStatus || "").trim().toUpperCase();
    metadata.reviewStatus = nextReviewStatus;
    if (input.reviewReason !== undefined) {
      metadata.reviewReason = String(input.reviewReason || "").trim();
    } else if (nextReviewStatus !== "REJECTED") {
      delete metadata.reviewReason;
    }
  }

  if (input.reportStatus !== undefined || input.reportResolutionNote !== undefined) {
    let reportSnapshot = buildContentReportSnapshot(metadata);
    const nextReportStatus = normalizeReportStatusValue(input.reportStatus);
    const nextResolutionNote =
      input.reportResolutionNote !== undefined
        ? String(input.reportResolutionNote || "").trim().slice(0, 120)
        : reportSnapshot.reportResolutionNote;

    if (!reportSnapshot.reportTotal && nextReportStatus && nextReportStatus !== "UNSET") {
      return { statusCode: 400, payload: { ok: false, message: "当前内容没有待处理的举报记录" } };
    }

    if (nextReportStatus === "RESOLVED" || nextReportStatus === "IGNORED") {
      const resolvedAt = new Date().toISOString();
      let matchedPending = false;
      let lastHandledIndex = -1;
      const nextLogs = reportSnapshot.reportLogs.map((item, index) => {
        if (item.status !== "PENDING") {
          lastHandledIndex = index;
          return item;
        }

        matchedPending = true;
        lastHandledIndex = index;
        return {
          ...item,
          status: nextReportStatus,
          resolvedAt,
          resolutionNote: nextResolutionNote,
        };
      });

      if (!matchedPending && lastHandledIndex >= 0) {
        nextLogs[lastHandledIndex] = {
          ...nextLogs[lastHandledIndex],
          status: nextReportStatus,
          resolvedAt,
          resolutionNote: nextResolutionNote,
        };
      }

      reportSnapshot = buildContentReportSnapshot({
        ...metadata,
        reportLogs: nextLogs,
        reportStatus: nextReportStatus,
        reportResolutionNote: nextResolutionNote,
      });
      applyContentReportSnapshot(metadata, reportSnapshot);
    } else if (nextReportStatus === "PENDING") {
      if (!reportSnapshot.reportPendingCount) {
        return { statusCode: 400, payload: { ok: false, message: "当前内容没有待处理的举报记录" } };
      }

      reportSnapshot = buildContentReportSnapshot({
        ...metadata,
        reportStatus: "PENDING",
        reportResolutionNote: "",
      });
      applyContentReportSnapshot(metadata, reportSnapshot);
    } else if (input.reportResolutionNote !== undefined && (reportSnapshot.reportStatus === "RESOLVED" || reportSnapshot.reportStatus === "IGNORED")) {
      const nextLogs = [...reportSnapshot.reportLogs];
      for (let index = nextLogs.length - 1; index >= 0; index -= 1) {
        if (nextLogs[index].status === "RESOLVED" || nextLogs[index].status === "IGNORED") {
          nextLogs[index] = {
            ...nextLogs[index],
            resolutionNote: nextResolutionNote,
          };
          break;
        }
      }

      reportSnapshot = buildContentReportSnapshot({
        ...metadata,
        reportLogs: nextLogs,
        reportStatus: reportSnapshot.reportStatus,
        reportResolutionNote: nextResolutionNote,
      });
      applyContentReportSnapshot(metadata, reportSnapshot);
    }
  }

  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      status: input.status ? String(input.status).trim().toUpperCase() : existingPost.status,
      isPinned:
        input.isPinned === undefined ? existingPost.isPinned : normalizeBoolean(input.isPinned, existingPost.isPinned),
      isEssence:
        input.isEssence === undefined ? existingPost.isEssence : normalizeBoolean(input.isEssence, existingPost.isEssence),
      metadata,
      updatedAt: new Date(),
    },
    include: {
      author: {
        include: {
          profile: true,
        },
      },
    },
  });
  const updatedReportSnapshot = buildContentReportSnapshot(metadata);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        id: updated.id,
        title: updated.title || updated.summary || updated.contentText.slice(0, 48) || "无标题内容",
        summary: updated.summary || updated.contentText.slice(0, 120),
        authorName: profileOf(updated.author).nickname || "微信用户",
        type: updated.type,
        typeLabel: mapPostType(updated.type),
        status: updated.status,
        statusLabel: mapPostStatus(updated.status),
        reviewStatus: String(metadata.reviewStatus || "").trim().toUpperCase() || "UNSET",
        reviewStatusLabel: mapReviewStatus(metadata.reviewStatus),
        reviewReason: metadata.reviewReason || "",
        reportStatus: updatedReportSnapshot.reportStatus || "UNSET",
        reportStatusLabel: mapReportStatus(updatedReportSnapshot.reportStatus),
        reportTotal: updatedReportSnapshot.reportTotal,
        reportPendingCount: updatedReportSnapshot.reportPendingCount,
        reportResolvedCount: updatedReportSnapshot.reportResolvedCount,
        reportIgnoredCount: updatedReportSnapshot.reportIgnoredCount,
        latestReportReason: updatedReportSnapshot.latestReportReason,
        latestReportedAt: updatedReportSnapshot.latestReportedAt,
        reportResolutionNote: updatedReportSnapshot.reportResolutionNote,
        reportLogs: buildAdminContentReportLogs(updatedReportSnapshot),
        isPinned: updated.isPinned,
        isEssence: updated.isEssence,
        readingCount: updated.readingCount,
        likeCount: updated.likeCount,
        commentCount: updated.commentCount,
        columnId: metadata.columnId || "",
        columnTitle: metadata.columnTitle || "",
        answerStatus: metadata.answerStatus || "",
        attachments: Array.isArray(updated.attachments) ? updated.attachments : [],
        publishedAt: toIso(updated.publishedAt),
        createdAt: toIso(updated.createdAt),
        updatedAt: toIso(updated.updatedAt),
      },
    },
  };
}

module.exports = {
  getAdminIncome,
  getAdminRenewal,
  getAdminPromotion,
  getAdminPromotionChannels,
  createAdminPromotionChannel,
  resolvePromotionChannelScene,
  getAdminChannelLiveSummary,
  getAdminCoupons,
  getAdminRenewalCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  updateAdminCouponStatus,
  createAdminRenewalNotice,
  getAdminRenewalNotices,
  getAdminRenewalSettings,
  updateAdminRenewalGuidance,
  updateAdminRenewalSettings,
  getAdminPaywallHighlights,
  updateAdminPaywallHighlights,
  getAdminMembers,
  getAdminContent,
  getAdminScoreboard,
  updateAdminScoreboard,
  getAdminMemberVerification,
  getMemberVerificationCheck,
  exportAdminChannelLiveMembers,
  exportAdminMembers,
  exportAdminContent,
  updateAdminMemberReview,
  updateAdminMemberStatus,
  getAdminPermissions,
  updateAdminPermissions,
  updateAdminContent,
  getAdminManageableGroups,
  authorizeAdminGroupAccess,
  authorizeWebBossAccess,
};
