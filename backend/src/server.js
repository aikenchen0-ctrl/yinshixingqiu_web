const http = require("http");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
const {
  buildPreview,
  listJoinCoupons,
  listJoinChannels,
  createJoinOrder,
  createRenewalOrder,
  reapplyJoinReview,
  applyPaymentSuccess,
  getMembershipStatus,
  getOrder,
  getDebugState,
} = require("./services/joinFlowService");
const { startAccessTokenRefreshScheduler } = require("./services/wechatService");
const {
  assertWechatPayResourceMatchesConfig,
  buildNotifyFailPayload,
  buildNotifySuccessPayload,
  getWechatPayConfig,
  inspectWechatPayReadiness,
  parseWechatPayNotification,
} = require("./services/wechatPayService");
const {
  loginOrRegister,
  loginOrRegisterByPhone,
  loginWeb,
  loginWebByMobile,
  getSessionProfile,
  updateSessionProfile,
  logoutSession,
} = require("./services/authService");
const {
  createPlanet,
  updatePlanetProfile,
  leavePlanetMembership,
  requestPlanetRefundReview,
  reviewPlanetRefundRequest,
  getRefundApprovalDashboard,
  getPlanetRefundManagement,
  refundPlanetMemberByOwner,
  deletePlanetByOwner,
  getDiscoverPlanets,
  getJoinedPlanets,
  getMyPlanets,
  getPlanetMembers,
} = require("./services/planetService");
const {
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
  listMyPosts,
  createComment,
  togglePostLike,
  toggleCommentLike,
} = require("./services/contentService");
const {
  listArticles,
  getArticleDetail,
  saveArticle,
  updateArticleStatus,
} = require("./services/articleService");
const {
  listCourses,
  getCourseDetail,
  getCourseLessonDetail,
  saveCourseProgress,
  listAdminCourses,
  getAdminCourseDetail,
  saveAdminCourse,
  updateAdminCourseStatus,
  saveAdminCourseLesson,
  updateAdminCourseLessonStatus,
  reorderAdminCourseLessons,
} = require("./services/courseService");
const { createArticleUnlockOrder } = require("./services/articleUnlockService");
const {
  listCheckinChallenges,
  getCheckinChallengeDetail,
  createCheckinChallenge,
  joinCheckinChallenge,
  publishCheckinPost,
  getCheckinRankings,
  getCheckinRecord,
} = require("./services/checkinService");
const {
  listColumns,
  getColumnDetail,
  createColumn,
} = require("./services/columnService");
const {
  trackMallAnalyticsEvent,
  getMallConfig,
  listMallCoupons,
  listMallCategories,
  listMallProducts,
  getMallProductDetail,
  createMallProductShareToken,
  listMallProductReviews,
  createMallProductReview,
  getMallShippingAddress,
  upsertMallShippingAddress,
  setDefaultMallShippingAddress,
  deleteMallShippingAddress,
  listMallCart,
  addMallCartItem,
  updateMallCartItem,
  deleteMallCartItem,
  clearMallCart,
  createMallOrder,
  prepareMallOrderPayment,
  listMallOrders,
  listMallCommissionOrders,
  getMallOrderDetail,
  confirmMallOrderReceipt,
  requestMallOrderRefund,
  startMallOrderAutoCloseScheduler,
  startMallOrderAutoReceiveScheduler,
  findMallOrderByOrderNo,
  applyMallOrderPaymentSuccess,
  listAdminMallCategories,
  createAdminMallCategory,
  updateAdminMallCategory,
  listAdminMallProducts,
  createAdminMallProduct,
  updateAdminMallProduct,
  listAdminMallProductDetailImages,
  updateAdminMallProductDetailImages,
  listAdminMallOrders,
  getAdminMallMemberZoneConfig,
  getAdminMallCouponAnalytics,
  updateAdminMallMemberZoneConfig,
  updateAdminMallOrderStatus,
  reviewAdminMallOrderRefund,
  shipAdminMallOrder,
  authorizeMallAdminAccess,
} = require("./services/mallService");
const { updateGroupSubscription } = require("./services/notificationService");
const {
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
} = require("./services/adminService");
const { queryKB } = require("./services/kbService");
const { askAIWithKB } = require("./services/aiService");
const { sendJson, sendText, readJsonBody } = require("./utils/http");
const { mapErrorToResponse } = require("./utils/error");
const { prisma } = require("./db/prisma");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
const uploadRootPath = path.join(__dirname, "..", "uploads");
const officialWebsiteRootPath = path.resolve(
  process.env.OFFICIAL_WEBSITE_ROOT || path.join(__dirname, "..", "..", "official_website")
);
const officialWebsiteHosts = new Set(
  (process.env.OFFICIAL_WEBSITE_HOSTS || "xueyin.net.cn,www.xueyin.net.cn")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
);

function isEnabledEnvValue(value, defaultValue) {
  const normalizedValue = String(value ?? defaultValue)
    .trim()
    .toLowerCase();
  return !["0", "false", "off", "no"].includes(normalizedValue);
}

function shouldStartBackgroundJobs() {
  return isEnabledEnvValue(process.env.XUEYIN_BACKGROUND_JOBS, "1");
}

function ensureUploadDir() {
  if (!fs.existsSync(uploadRootPath)) {
    fs.mkdirSync(uploadRootPath, { recursive: true });
  }
}

function sendFile(req, res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(res, 404, {
      ok: false,
      message: "文件不存在",
    });
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const mimeTypeMap = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".ogv": "video/ogg",
    ".ogg": "video/ogg",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".zip": "application/zip",
    ".rar": "application/vnd.rar",
  };

  const stat = fs.statSync(filePath);
  const mimeType = mimeTypeMap[extension] || "application/octet-stream";
  const rangeHeader = typeof req.headers.range === "string" ? req.headers.range.trim() : "";

  if (rangeHeader) {
    const matched = /bytes=(\d*)-(\d*)/i.exec(rangeHeader);
    const total = stat.size;
    const start = matched && matched[1] ? Number(matched[1]) : 0;
    const end = matched && matched[2] ? Number(matched[2]) : total - 1;

    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end >= total) {
      res.writeHead(416, {
        "Content-Range": `bytes */${total}`,
        "Access-Control-Allow-Origin": "*",
      });
      res.end();
      return;
    }

    res.writeHead(206, {
      "Content-Type": mimeType,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000",
      "Access-Control-Allow-Origin": "*",
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    "Content-Type": mimeType,
    "Content-Length": stat.size,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000",
    "Access-Control-Allow-Origin": "*",
  });

  fs.createReadStream(filePath).pipe(res);
}

const videoUploadExtensionPattern = /\.(mp4|m4v|mov|webm|ogv|ogg)$/i;

function isAllowedVideoUpload(file) {
  if (!file || typeof file !== "object") {
    return false;
  }

  const mimeType = String(file.mimeType || "").trim().toLowerCase();
  const filename = String(file.filename || "").trim();
  return /^video\//.test(mimeType) || videoUploadExtensionPattern.test(filename);
}

function normalizeHostname(value) {
  return String(value || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

function getRequestHostname(req) {
  return normalizeHostname(req.headers["x-forwarded-host"] || req.headers.host);
}

function shouldServeOfficialWebsite(req) {
  return officialWebsiteHosts.has(getRequestHostname(req));
}

function sendOfficialWebsiteFile(req, res, filePath, cacheControl) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(res, 404, {
      ok: false,
      message: "Not Found",
    });
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const mimeTypeMap = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
  };

  res.writeHead(200, {
    "Content-Type": mimeTypeMap[extension] || "application/octet-stream",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
}

function serveOfficialWebsite(req, res, requestUrl) {
  if (!shouldServeOfficialWebsite(req)) {
    return false;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, {
      ok: false,
      message: "Method Not Allowed",
    });
    return true;
  }

  if (requestUrl.pathname === "/") {
    sendOfficialWebsiteFile(req, res, path.join(officialWebsiteRootPath, "index.html"), "no-cache");
    return true;
  }

  let decodedPathname = "";
  try {
    decodedPathname = decodeURIComponent(requestUrl.pathname);
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      message: "Bad Request",
    });
    return true;
  }

  const requestedPath = path.resolve(officialWebsiteRootPath, `.${decodedPathname}`);
  if (requestedPath !== officialWebsiteRootPath && !requestedPath.startsWith(`${officialWebsiteRootPath}${path.sep}`)) {
    sendJson(res, 403, {
      ok: false,
      message: "Forbidden",
    });
    return true;
  }

  const cacheControl = decodedPathname.startsWith("/assets/")
    ? "public, max-age=2592000, immutable"
    : "no-cache";
  sendOfficialWebsiteFile(req, res, requestedPath, cacheControl);
  return true;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}

function parseMultipartFile(buffer, contentType) {
  const boundaryMatch = /boundary=([^;]+)/i.exec(contentType || "");
  if (!boundaryMatch) {
    return null;
  }

  const boundary = Buffer.from(`--${boundaryMatch[1]}`);
  const headerEndMarker = Buffer.from("\r\n\r\n");
  const start = buffer.indexOf(boundary);
  if (start < 0) {
    return null;
  }

  const headerStart = start + boundary.length + 2;
  const headerEnd = buffer.indexOf(headerEndMarker, headerStart);
  if (headerEnd < 0) {
    return null;
  }

  const headerText = buffer.slice(headerStart, headerEnd).toString("utf8");
  const filenameMatch = /filename="([^"]+)"/i.exec(headerText);
  const typeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headerText);
  const fileStart = headerEnd + headerEndMarker.length;
  const nextBoundaryIndex = buffer.indexOf(boundary, fileStart);
  if (nextBoundaryIndex < 0) {
    return null;
  }

  const fileEnd = nextBoundaryIndex - 2;
  const fileBuffer = buffer.slice(fileStart, fileEnd);

  return {
    filename: filenameMatch ? filenameMatch[1] : "image.jpg",
    mimeType: typeMatch ? typeMatch[1].trim() : "application/octet-stream",
    buffer: fileBuffer,
  };
}

function createUploadFileName(originalName) {
  const extension = path.extname(originalName || "").toLowerCase() || ".dat";
  const safeExtension = /^[.\w-]{1,12}$/.test(extension) ? extension : ".dat";
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${stamp}_${random}${safeExtension}`;
}

function saveUploadedFile(req, file) {
  const todayFolder = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const targetDir = path.join(uploadRootPath, todayFolder);
  fs.mkdirSync(targetDir, { recursive: true });

  const savedName = createUploadFileName(file.filename);
  const savedPath = path.join(targetDir, savedName);
  fs.writeFileSync(savedPath, file.buffer);

  const fileUrl = `/uploads/${todayFolder}/${savedName}`;
  return {
    url: fileUrl,
    filename: file.filename || savedName,
    savedName,
    mimeType: file.mimeType || "application/octet-stream",
    size: file.buffer.length,
  };
}

function getSchemaSummary() {
  const schema = fs.readFileSync(schemaPath, "utf8");
  const modelMatches = [...schema.matchAll(/^model\s+(\w+)/gm)];
  const enumMatches = [...schema.matchAll(/^enum\s+(\w+)/gm)];

  return {
    schemaPath,
    modelCount: modelMatches.length,
    enumCount: enumMatches.length,
    models: modelMatches.map((match) => match[1]),
    enums: enumMatches.map((match) => match[1]),
  };
}

async function ensureAdminRequestAccess(req, res, requestUrl, explicitGroupId) {
  const result = await authorizeAdminGroupAccess({
    groupId: explicitGroupId || requestUrl.searchParams.get("groupId"),
    sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
  });

  if (result.statusCode !== 200) {
    sendJson(res, result.statusCode, result.payload);
    return null;
  }

  return result.payload.data;
}

async function ensureWebBossRequestAccess(req, res, requestUrl) {
  const result = await authorizeWebBossAccess({
    sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
  });

  if (result.statusCode !== 200) {
    sendJson(res, result.statusCode, result.payload);
    return null;
  }

  return result.payload.data;
}

function readMallStoreId(requestUrl, body) {
  const requestStoreId = requestUrl.searchParams.get("storeId") || requestUrl.searchParams.get("groupId");
  if (requestStoreId) {
    return requestStoreId;
  }

  return body ? body.storeId || body.groupId : "";
}

async function ensureMallAdminRequestAccess(req, res, requestUrl, body) {
  const result = await authorizeMallAdminAccess({
    storeId: readMallStoreId(requestUrl, body),
    sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
  });

  if (result.statusCode !== 200) {
    sendJson(res, result.statusCode, result.payload);
    return null;
  }

  return result.payload.data;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);
  console.log(`[request] ${req.method} ${requestUrl.pathname}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,x-session-token,Authorization",
    });
    res.end();
    return;
  }

  try {
    if (serveOfficialWebsite(req, res, requestUrl)) {
      return;
    }

    if (req.method === "GET" && requestUrl.pathname.startsWith("/uploads/")) {
      const relativePath = requestUrl.pathname.replace(/^\/uploads\//, "");
      const normalizedPath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
      const filePath = path.join(uploadRootPath, normalizedPath);
      sendFile(req, res, filePath);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/preview") {
      const result = await buildPreview(
        requestUrl.searchParams.get("groupId"),
        requestUrl.searchParams.get("userId"),
        requestUrl.searchParams.get("couponCode"),
        requestUrl.searchParams.get("channelCode")
      );
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/join-coupons") {
      const result = await listJoinCoupons({
        groupId: requestUrl.searchParams.get("groupId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/join-channels") {
      const result = await listJoinChannels({
        groupId: requestUrl.searchParams.get("groupId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/planets/create") {
      const body = await readJsonBody(req);
      const sessionToken = req.headers["x-session-token"];
      const result = await createPlanet(sessionToken, body);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/planets/profile") {
      const body = await readJsonBody(req);
      const sessionToken = req.headers["x-session-token"] || body.sessionToken;
      const result = await updatePlanetProfile(sessionToken, body);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/planets/leave") {
      const body = await readJsonBody(req);
      const sessionToken = req.headers["x-session-token"] || body.sessionToken;
      const result = await leavePlanetMembership(sessionToken, body);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/planets/delete") {
      const body = await readJsonBody(req);
      const sessionToken = req.headers["x-session-token"] || body.sessionToken;
      const result = await deletePlanetByOwner(sessionToken, body);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/refunds/dashboard") {
      const sessionToken = requestUrl.searchParams.get("sessionToken");
      const result = await getRefundApprovalDashboard(sessionToken);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/refunds/request") {
      const body = await readJsonBody(req);
      const sessionToken = req.headers["x-session-token"] || body.sessionToken;
      const result = await requestPlanetRefundReview(sessionToken, body);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/refunds/review") {
      const body = await readJsonBody(req);
      const sessionToken = req.headers["x-session-token"] || body.sessionToken;
      const result = await reviewPlanetRefundRequest(sessionToken, body);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/refund-management") {
      const sessionToken = requestUrl.searchParams.get("sessionToken");
      const result = await getPlanetRefundManagement(sessionToken, {
        groupId: requestUrl.searchParams.get("groupId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/planets/refund-member") {
      const body = await readJsonBody(req);
      const sessionToken = req.headers["x-session-token"] || body.sessionToken;
      const result = await refundPlanetMemberByOwner(sessionToken, body);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/mine") {
      const sessionToken = requestUrl.searchParams.get("sessionToken");
      const result = await getMyPlanets(sessionToken);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/joined") {
      const sessionToken = requestUrl.searchParams.get("sessionToken");
      const result = await getJoinedPlanets(sessionToken);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/discover") {
      const sessionToken = requestUrl.searchParams.get("sessionToken");
      const result = await getDiscoverPlanets(sessionToken, {
        limit: requestUrl.searchParams.get("limit"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/home") {
      const result = await getGroupHome(requestUrl.searchParams.get("groupId"), {
        sessionToken: requestUrl.searchParams.get("sessionToken"),
        userId: requestUrl.searchParams.get("userId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/promotion-scene/resolve") {
      const result = await resolvePromotionChannelScene({
        scene: requestUrl.searchParams.get("scene"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/posts") {
      const result = await listPostsByTab(requestUrl.searchParams.get("groupId"), {
        tab: requestUrl.searchParams.get("tab"),
        cursor: requestUrl.searchParams.get("cursor"),
        limit: requestUrl.searchParams.get("limit"),
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/pinned-posts") {
      const result = await listPinnedPosts(requestUrl.searchParams.get("groupId"), {
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/discover-featured-posts") {
      const result = await listDiscoverFeaturedPosts({
        limit: requestUrl.searchParams.get("limit"),
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/planets/posts") {
      const body = await readJsonBody(req);
      const result = await createPost({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/planets/posts") {
      const body = await readJsonBody(req);
      const result = await updatePost({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/planets/posts/assign-column") {
      const body = await readJsonBody(req);
      const result = await assignPostColumn({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/planets/subscription") {
      const body = await readJsonBody(req);
      const result = await updateGroupSubscription({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/members") {
      const result = await getPlanetMembers(
        requestUrl.searchParams.get("groupId"),
        req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken")
      );
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/checkin/challenges") {
      const result = await listCheckinChallenges({
        groupId: requestUrl.searchParams.get("groupId"),
        status: requestUrl.searchParams.get("status"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        userId: requestUrl.searchParams.get("userId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/checkin/challenges/detail") {
      const result = await getCheckinChallengeDetail({
        challengeId: requestUrl.searchParams.get("challengeId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        userId: requestUrl.searchParams.get("userId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/checkin/challenges/create") {
      const body = await readJsonBody(req);
      const result = await createCheckinChallenge({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/checkin/rankings") {
      const result = await getCheckinRankings({
        challengeId: requestUrl.searchParams.get("challengeId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        userId: requestUrl.searchParams.get("userId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/checkin/records") {
      const result = await getCheckinRecord({
        challengeId: requestUrl.searchParams.get("challengeId"),
        year: requestUrl.searchParams.get("year"),
        month: requestUrl.searchParams.get("month"),
        day: requestUrl.searchParams.get("day"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        userId: requestUrl.searchParams.get("userId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/checkin/challenges/join") {
      const body = await readJsonBody(req);
      const result = await joinCheckinChallenge({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/checkin/posts") {
      const body = await readJsonBody(req);
      const result = await publishCheckinPost({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/columns") {
      const result = await listColumns(requestUrl.searchParams.get("groupId"), {
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        userId: requestUrl.searchParams.get("userId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/columns/detail") {
      const result = await getColumnDetail(
        requestUrl.searchParams.get("columnId"),
        requestUrl.searchParams.get("groupId"),
        {
          sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
          userId: requestUrl.searchParams.get("userId"),
        }
      );
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/planets/columns") {
      const body = await readJsonBody(req);
      const result = await createColumn({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/planets/posts/delete") {
      const body = await readJsonBody(req);
      const result = await deletePost({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/my-posts") {
      const result = await listMyPosts(requestUrl.searchParams.get("sessionToken"));
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/articles") {
      const result = await listArticles({
        groupId: requestUrl.searchParams.get("groupId"),
        search: requestUrl.searchParams.get("search"),
        status: requestUrl.searchParams.get("status"),
        contentSource: requestUrl.searchParams.get("contentSource"),
        accessType: requestUrl.searchParams.get("accessType"),
        includeRestricted: requestUrl.searchParams.get("includeRestricted"),
        page: requestUrl.searchParams.get("page"),
        pageSize: requestUrl.searchParams.get("pageSize"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        userId: requestUrl.searchParams.get("userId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/articles/detail") {
      const result = await getArticleDetail({
        articleId: requestUrl.searchParams.get("articleId"),
        id: requestUrl.searchParams.get("id"),
        postId: requestUrl.searchParams.get("postId"),
        incrementRead: requestUrl.searchParams.get("incrementRead") !== "0",
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        userId: requestUrl.searchParams.get("userId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/articles") {
      const body = await readJsonBody(req);
      const result = await saveArticle({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/articles") {
      const body = await readJsonBody(req);
      const result = await saveArticle({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/articles/unlock-orders") {
      const body = await readJsonBody(req);
      const result = await createArticleUnlockOrder({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PATCH" && requestUrl.pathname === "/api/articles/status") {
      const body = await readJsonBody(req);
      const result = await updateArticleStatus({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/courses") {
      const result = await listCourses({
        groupId: requestUrl.searchParams.get("groupId"),
        search: requestUrl.searchParams.get("search"),
        category: requestUrl.searchParams.get("category"),
        status: requestUrl.searchParams.get("status"),
        includeRestricted: requestUrl.searchParams.get("includeRestricted"),
        page: requestUrl.searchParams.get("page"),
        pageSize: requestUrl.searchParams.get("pageSize"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        userId: requestUrl.searchParams.get("userId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/courses/detail") {
      const result = await getCourseDetail({
        courseId: requestUrl.searchParams.get("courseId"),
        id: requestUrl.searchParams.get("id"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        userId: requestUrl.searchParams.get("userId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/courses/lessons/detail") {
      const result = await getCourseLessonDetail({
        lessonId: requestUrl.searchParams.get("lessonId"),
        id: requestUrl.searchParams.get("id"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        userId: requestUrl.searchParams.get("userId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/courses/progress") {
      const body = await readJsonBody(req);
      const result = await saveCourseProgress({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/posts/detail") {
      const result = await getPostDetail(requestUrl.searchParams.get("postId"), {
        incrementRead: requestUrl.searchParams.get("incrementRead") !== "0",
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/posts/comments") {
      const result = await listComments(requestUrl.searchParams.get("postId"), {
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/posts/comments") {
      const body = await readJsonBody(req);
      const result = await createComment({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/posts/like") {
      const body = await readJsonBody(req);
      const result = await togglePostLike(body.postId, body.increment !== false, {
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/posts/report") {
      const body = await readJsonBody(req);
      const result = await reportPost({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/comments/like") {
      const body = await readJsonBody(req);
      const result = await toggleCommentLike(body.commentId, body.increment !== false, {
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/uploads/image") {
      ensureUploadDir();
      const rawBody = await readRawBody(req);
      const file = parseMultipartFile(rawBody, req.headers["content-type"]);

      if (!file || !file.buffer.length) {
        sendJson(res, 400, {
          ok: false,
          message: "图片上传失败，未解析到文件内容",
        });
        return;
      }

      if (!/^image\//i.test(file.mimeType)) {
        sendJson(res, 400, {
          ok: false,
          message: "仅支持上传图片文件",
        });
        return;
      }

      const uploadResult = saveUploadedFile(req, file);
      sendJson(res, 201, {
        ok: true,
        data: {
          url: uploadResult.url,
          filename: uploadResult.savedName,
        },
      });
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/uploads/video") {
      ensureUploadDir();
      const rawBody = await readRawBody(req);
      const file = parseMultipartFile(rawBody, req.headers["content-type"]);

      if (!file || !file.buffer.length) {
        sendJson(res, 400, {
          ok: false,
          message: "视频上传失败，未解析到文件内容",
        });
        return;
      }

      if (!isAllowedVideoUpload(file)) {
        sendJson(res, 400, {
          ok: false,
          message: "仅支持上传 MP4、MOV、M4V、WebM、OGG 视频",
        });
        return;
      }

      if (file.buffer.length > 80 * 1024 * 1024) {
        sendJson(res, 400, {
          ok: false,
          message: "单个视频不能超过80MB",
        });
        return;
      }

      const uploadResult = saveUploadedFile(req, file);
      sendJson(res, 201, {
        ok: true,
        data: uploadResult,
      });
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/uploads/file") {
      ensureUploadDir();
      const rawBody = await readRawBody(req);
      const file = parseMultipartFile(rawBody, req.headers["content-type"]);

      if (!file || !file.buffer.length) {
        sendJson(res, 400, {
          ok: false,
          message: "文件上传失败，未解析到文件内容",
        });
        return;
      }

      if (file.buffer.length > 20 * 1024 * 1024) {
        sendJson(res, 400, {
          ok: false,
          message: "单个文件不能超过20MB",
        });
        return;
      }

      const uploadResult = saveUploadedFile(req, file);
      sendJson(res, 201, {
        ok: true,
        data: uploadResult,
      });
      return;
    }

    if (
      req.method === "POST" &&
      (requestUrl.pathname === "/pay/notify" || requestUrl.pathname === "/api/payments/wechat/notify")
    ) {
      const rawBody = await readRawBody(req);
      const bodyText = rawBody.toString("utf8");

      try {
        const notification = await parseWechatPayNotification({
          headers: req.headers,
          bodyText,
        });
        const payConfig = getWechatPayConfig();
        const resource = notification.resource || {};
        const orderNo = String(resource.out_trade_no || "").trim();
        const transactionNo = String(resource.transaction_id || "").trim();
        const tradeState = String(resource.trade_state || "").trim().toUpperCase();
        const totalAmount = resource.amount ? Number(resource.amount.total) : NaN;

        if (!orderNo || !transactionNo) {
          sendText(
            res,
            400,
            JSON.stringify(buildNotifyFailPayload("缺少订单号或微信交易号")),
            "application/json; charset=utf-8"
          );
          return;
        }

        try {
          assertWechatPayResourceMatchesConfig(resource, payConfig);
        } catch (identityError) {
          sendText(
            res,
            400,
            JSON.stringify(buildNotifyFailPayload(identityError.message || "回调商户信息不匹配")),
            "application/json; charset=utf-8"
          );
          return;
        }

        const orderResult = await getOrder(orderNo);
        const isNormalOrder = orderResult.statusCode === 200 && orderResult.payload.ok && orderResult.payload.data;
        const mallOrder = isNormalOrder ? null : await findMallOrderByOrderNo(orderNo);

        if (!isNormalOrder && !mallOrder) {
          sendText(
            res,
            404,
            JSON.stringify(buildNotifyFailPayload("订单不存在")),
            "application/json; charset=utf-8"
          );
          return;
        }

        const expectedAmount = isNormalOrder
          ? Number(orderResult.payload.data.order.amount)
          : Math.round(Number(mallOrder.payableAmount || 0) * 100);
        if (Number.isFinite(totalAmount) && totalAmount !== expectedAmount) {
          sendText(
            res,
            400,
            JSON.stringify(buildNotifyFailPayload("订单金额不匹配")),
            "application/json; charset=utf-8"
          );
          return;
        }

        if (tradeState && tradeState !== "SUCCESS") {
          sendText(
            res,
            200,
            JSON.stringify(buildNotifySuccessPayload()),
            "application/json; charset=utf-8"
          );
          return;
        }

        const result = isNormalOrder
          ? await applyPaymentSuccess({
              orderNo,
              transactionNo,
              success: true,
            })
          : await applyMallOrderPaymentSuccess({
              orderNo,
              transactionNo,
              success: true,
            });

        if (result.statusCode !== 200 || !result.payload.ok) {
          sendText(
            res,
            400,
            JSON.stringify(buildNotifyFailPayload(result.payload.message || "支付结果处理失败")),
            "application/json; charset=utf-8"
          );
          return;
        }

        sendText(
          res,
          200,
          JSON.stringify(buildNotifySuccessPayload()),
          "application/json; charset=utf-8"
        );
        return;
      } catch (error) {
        console.error("[wechat-pay] notify failed", error);
        sendText(
          res,
          400,
          JSON.stringify(buildNotifyFailPayload(error && error.message ? error.message : "回调处理失败")),
          "application/json; charset=utf-8"
        );
        return;
      }
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/orders/join") {
      const body = await readJsonBody(req);
      const result = await createJoinOrder({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/orders/renewal") {
      const body = await readJsonBody(req);
      const result = await createRenewalOrder({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/orders/join/reapply") {
      const body = await readJsonBody(req);
      const result = await reapplyJoinReview(body);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/payments/mock-callback") {
      const body = await readJsonBody(req);
      let result = await applyPaymentSuccess(body);
      if (result.statusCode === 404) {
        result = await applyMallOrderPaymentSuccess(body);
      }
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/memberships/status") {
      const result = await getMembershipStatus(
        requestUrl.searchParams.get("groupId"),
        requestUrl.searchParams.get("userId")
      );
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/auth/login") {
      const body = await readJsonBody(req);
      console.log("[auth] login request received", {
        nickname: body.nickname || "",
        mobile: body.mobile || "",
        hasLoginCode: Boolean(body.loginCode),
      });
      const result = await loginOrRegister(body);
      console.log("[auth] login response", {
        statusCode: result.statusCode,
        ok: result.payload.ok,
        message: result.payload.message || "",
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/auth/phone-login") {
      const body = await readJsonBody(req);
      console.log("[auth] phone login request received", {
        hasLoginCode: Boolean(body.loginCode),
        hasPhoneCode: Boolean(body.phoneCode),
      });
      const result = await loginOrRegisterByPhone(body);
      console.log("[auth] phone login response", {
        statusCode: result.statusCode,
        ok: result.payload.ok,
        message: result.payload.message || "",
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/auth/web-login") {
      const body = await readJsonBody(req);
      console.log("[auth] web login request received", {
        account: body.account || body.mobile || "",
      });
      const result = await loginWeb(body);
      console.log("[auth] web login response", {
        statusCode: result.statusCode,
        ok: result.payload.ok,
        message: result.payload.message || "",
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/auth/web-mobile-login") {
      const body = await readJsonBody(req);
      console.log("[auth] web mobile login request received", {
        mobile: body.mobile || body.account || "",
      });
      const result = await loginWeb(body);
      console.log("[auth] web mobile login response", {
        statusCode: result.statusCode,
        ok: result.payload.ok,
        message: result.payload.message || "",
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/auth/session") {
      const result = await getSessionProfile(requestUrl.searchParams.get("sessionToken"));
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/mall/config") {
      const result = await getMallConfig({
        storeId: readMallStoreId(requestUrl),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/mall/categories") {
      const result = await listMallCategories({
        storeId: readMallStoreId(requestUrl),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/mall/coupons") {
      const result = await listMallCoupons({
        storeId: readMallStoreId(requestUrl),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/mall/products") {
      const result = await listMallProducts({
        storeId: readMallStoreId(requestUrl),
        categoryId: requestUrl.searchParams.get("categoryId"),
        keyword: requestUrl.searchParams.get("keyword"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/mall/products/detail") {
      const result = await getMallProductDetail({
        productId: requestUrl.searchParams.get("productId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/mall/share-token") {
      const body = await readJsonBody(req);
      const result = await createMallProductShareToken({
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        productId: body.productId,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/mall/analytics") {
      const body = await readJsonBody(req);
      const result = await trackMallAnalyticsEvent({
        storeId: readMallStoreId(requestUrl, body),
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        mallEventType: body.mallEventType,
        mallPage: body.mallPage,
        mallSource: body.mallSource,
        targetType: body.targetType,
        targetId: body.targetId,
        keyword: body.keyword,
        eventDedupKey: body.eventDedupKey,
        properties: body.properties,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/mall/reviews") {
      const result = await listMallProductReviews({
        productId: requestUrl.searchParams.get("productId"),
        limit: requestUrl.searchParams.get("limit"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/mall/reviews") {
      const body = await readJsonBody(req);
      const result = await createMallProductReview({
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        productId: body.productId,
        rating: body.rating,
        content: body.content,
        isAnonymous: body.isAnonymous,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/mall/address") {
      const result = await getMallShippingAddress({
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/mall/address") {
      const body = await readJsonBody(req);
      const result = await upsertMallShippingAddress({
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        addressId: body.addressId,
        createNew: body.createNew,
        isDefault: body.isDefault,
        recipientName: body.recipientName,
        phone: body.phone,
        province: body.province,
        city: body.city,
        district: body.district,
        detailAddress: body.detailAddress,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/mall/address/default") {
      const body = await readJsonBody(req);
      const result = await setDefaultMallShippingAddress({
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        addressId: body.addressId,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "DELETE" && requestUrl.pathname === "/api/mall/address") {
      const result = await deleteMallShippingAddress({
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        addressId: requestUrl.searchParams.get("addressId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/mall/cart") {
      const result = await listMallCart({
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/mall/cart/add") {
      const body = await readJsonBody(req);
      const result = await addMallCartItem({
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        productId: body.productId,
        quantity: body.quantity,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/mall/cart/update") {
      const body = await readJsonBody(req);
      const result = await updateMallCartItem({
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        productId: body.productId,
        quantity: body.quantity,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/mall/cart/delete") {
      const body = await readJsonBody(req);
      const result = await deleteMallCartItem({
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        productId: body.productId,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/mall/cart/clear") {
      const body = await readJsonBody(req);
      const result = await clearMallCart({
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/mall/orders/create") {
      const body = await readJsonBody(req);
      const result = await createMallOrder({
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        remark: body.remark,
        couponCode: body.couponCode,
        shareToken: body.shareToken,
        addressId: body.addressId,
        productId: body.productId,
        quantity: body.quantity,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/mall/orders/pay") {
      const body = await readJsonBody(req);
      const result = await prepareMallOrderPayment({
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        orderId: body.orderId,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/mall/orders") {
      const result = await listMallOrders({
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/mall/commissions") {
      const result = await listMallCommissionOrders({
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/mall/orders/detail") {
      const result = await getMallOrderDetail({
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        orderId: requestUrl.searchParams.get("orderId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/mall/orders/refund/request") {
      const body = await readJsonBody(req);
      const result = await requestMallOrderRefund({
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        orderId: body.orderId,
        reason: body.reason,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/mall/orders/receipt/confirm") {
      const body = await readJsonBody(req);
      const result = await confirmMallOrderReceipt({
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        orderId: body.orderId,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/auth/profile") {
      const body = await readJsonBody(req);
      const result = await updateSessionProfile({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/auth/logout") {
      const body = await readJsonBody(req);
      const result = await logoutSession(body.sessionToken);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/orders/detail") {
      const result = await getOrder(requestUrl.searchParams.get("orderNo"), {
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        userId: requestUrl.searchParams.get("userId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/debug/state") {
      const result = await getDebugState();
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/kb/search") {
      const result = await queryKB({
        query: requestUrl.searchParams.get("q") || "",
        limit: parseInt(requestUrl.searchParams.get("limit") || "8", 10),
        topic: requestUrl.searchParams.get("topic") || undefined,
        dateFrom: requestUrl.searchParams.get("dateFrom") || undefined,
        dateTo: requestUrl.searchParams.get("dateTo") || undefined,
      });
      sendJson(res, 200, { ok: true, data: result });
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/kb/search") {
      const body = await readJsonBody(req);
      const result = await queryKB({
        query: body.query || "",
        limit: body.limit || 8,
        topic: body.topic,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
      });
      sendJson(res, 200, { ok: true, data: result });
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/ai/ask") {
      const body = await readJsonBody(req);
      const result = await askAIWithKB(body);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "xueyin-backend",
        time: new Date().toISOString(),
      });
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/schema") {
      sendJson(res, 200, getSchemaSummary());
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/groups") {
      const result = await getAdminManageableGroups({
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/mall/categories") {
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await listAdminMallCategories({
        storeId: readMallStoreId(requestUrl),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/admin/mall/categories") {
      const body = await readJsonBody(req);
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl, body))) {
        return;
      }
      const result = await createAdminMallCategory({
        ...body,
        storeId: readMallStoreId(requestUrl, body),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/admin/mall/categories") {
      const body = await readJsonBody(req);
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl, body))) {
        return;
      }
      const result = await updateAdminMallCategory({
        ...body,
        storeId: readMallStoreId(requestUrl, body),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/mall/products") {
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await listAdminMallProducts({
        storeId: readMallStoreId(requestUrl),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/admin/mall/products") {
      const body = await readJsonBody(req);
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl, body))) {
        return;
      }
      const result = await createAdminMallProduct({
        ...body,
        storeId: readMallStoreId(requestUrl, body),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/admin/mall/products") {
      const body = await readJsonBody(req);
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl, body))) {
        return;
      }
      const result = await updateAdminMallProduct({
        ...body,
        storeId: readMallStoreId(requestUrl, body),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/mall/products/detail-images") {
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await listAdminMallProductDetailImages({
        storeId: readMallStoreId(requestUrl),
        productId: requestUrl.searchParams.get("productId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/admin/mall/products/detail-images") {
      const body = await readJsonBody(req);
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl, body))) {
        return;
      }
      const result = await updateAdminMallProductDetailImages({
        ...body,
        storeId: readMallStoreId(requestUrl, body),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/mall/orders") {
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await listAdminMallOrders({
        storeId: readMallStoreId(requestUrl),
        limit: requestUrl.searchParams.get("limit"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/mall/member-zone-config") {
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminMallMemberZoneConfig({
        storeId: readMallStoreId(requestUrl),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/admin/mall/member-zone-config") {
      const body = await readJsonBody(req);
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl, body))) {
        return;
      }
      const result = await updateAdminMallMemberZoneConfig({
        ...body,
        storeId: readMallStoreId(requestUrl, body),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/mall/coupon-analytics") {
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminMallCouponAnalytics({
        storeId: readMallStoreId(requestUrl),
        days: requestUrl.searchParams.get("days"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PATCH" && requestUrl.pathname === "/api/admin/mall/orders/status") {
      const body = await readJsonBody(req);
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl, body))) {
        return;
      }
      const result = await updateAdminMallOrderStatus({
        ...body,
        storeId: readMallStoreId(requestUrl, body),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/admin/mall/orders/refund/review") {
      const body = await readJsonBody(req);
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl, body))) {
        return;
      }
      const result = await reviewAdminMallOrderRefund({
        ...body,
        storeId: readMallStoreId(requestUrl, body),
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/admin/mall/orders/ship") {
      const body = await readJsonBody(req);
      if (!(await ensureMallAdminRequestAccess(req, res, requestUrl, body))) {
        return;
      }
      const result = await shipAdminMallOrder({
        ...body,
        storeId: readMallStoreId(requestUrl, body),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/income") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminIncome({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        startDate: requestUrl.searchParams.get("startDate"),
        endDate: requestUrl.searchParams.get("endDate"),
        rangeDays: requestUrl.searchParams.get("rangeDays"),
        page: requestUrl.searchParams.get("page"),
        pageSize: requestUrl.searchParams.get("pageSize"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/promotion") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminPromotion({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        startDate: requestUrl.searchParams.get("startDate"),
        endDate: requestUrl.searchParams.get("endDate"),
        rangeDays: requestUrl.searchParams.get("rangeDays"),
        page: requestUrl.searchParams.get("page"),
        pageSize: requestUrl.searchParams.get("pageSize"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/promotion/channels") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminPromotionChannels({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/admin/promotion/channels") {
      const body = await readJsonBody(req);
      if (!(await ensureAdminRequestAccess(req, res, requestUrl, body.groupId))) {
        return;
      }
      const result = await createAdminPromotionChannel({
        groupId: body.groupId,
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        name: body.name,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/renewal") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminRenewal({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        startDate: requestUrl.searchParams.get("startDate"),
        endDate: requestUrl.searchParams.get("endDate"),
        rangeDays: requestUrl.searchParams.get("rangeDays"),
        page: requestUrl.searchParams.get("page"),
        pageSize: requestUrl.searchParams.get("pageSize"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/renewal/coupons") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminRenewalCoupons({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/coupons") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminCoupons({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        couponType: requestUrl.searchParams.get("couponType"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/admin/coupons") {
      const body = await readJsonBody(req);
      if (!(await ensureAdminRequestAccess(req, res, requestUrl, body.groupId))) {
        return;
      }
      const result = await createAdminCoupon({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/admin/coupons") {
      const body = await readJsonBody(req);
      if (!(await ensureAdminRequestAccess(req, res, requestUrl, body.groupId))) {
        return;
      }
      const result = await updateAdminCoupon({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PATCH" && requestUrl.pathname === "/api/admin/coupons/status") {
      const body = await readJsonBody(req);
      if (!(await ensureAdminRequestAccess(req, res, requestUrl, body.groupId))) {
        return;
      }
      const result = await updateAdminCouponStatus({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/renewal/notices") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminRenewalNotices({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/admin/renewal/notices") {
      const body = await readJsonBody(req);
      if (!(await ensureAdminRequestAccess(req, res, requestUrl, body.groupId))) {
        return;
      }
      const result = await createAdminRenewalNotice({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/renewal/settings") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminRenewalSettings({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/admin/renewal/settings") {
      const body = await readJsonBody(req);
      if (!(await ensureAdminRequestAccess(req, res, requestUrl, body.groupId))) {
        return;
      }
      const result = await updateAdminRenewalSettings({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/admin/renewal/guidance") {
      const body = await readJsonBody(req);
      if (!(await ensureAdminRequestAccess(req, res, requestUrl, body.groupId))) {
        return;
      }
      const result = await updateAdminRenewalGuidance({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/paywall/highlights") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminPaywallHighlights({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/admin/paywall/highlights") {
      const body = await readJsonBody(req);
      if (!(await ensureAdminRequestAccess(req, res, requestUrl, body.groupId))) {
        return;
      }
      const result = await updateAdminPaywallHighlights({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/channel-live") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminChannelLiveSummary({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/channel-live/export") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await exportAdminChannelLiveMembers({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        onlyValidMembers: requestUrl.searchParams.get("onlyValidMembers"),
      });
      if (result.contentType) {
        sendText(res, result.statusCode, result.payload, result.contentType, {
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName || "video-live-member-list.csv")}`,
        });
      } else {
        sendJson(res, result.statusCode, result.payload);
      }
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/members/export") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await exportAdminMembers({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        status: requestUrl.searchParams.get("status"),
        sourceType: requestUrl.searchParams.get("sourceType"),
        search: requestUrl.searchParams.get("search"),
        startDate: requestUrl.searchParams.get("startDate"),
        endDate: requestUrl.searchParams.get("endDate"),
        rangeDays: requestUrl.searchParams.get("rangeDays"),
        page: requestUrl.searchParams.get("page"),
        pageSize: requestUrl.searchParams.get("pageSize"),
        scope: requestUrl.searchParams.get("scope"),
      });
      if (result.contentType) {
        sendText(res, result.statusCode, result.payload, result.contentType, {
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName || "member-report.csv")}`,
        });
      } else {
        sendJson(res, result.statusCode, result.payload);
      }
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/members") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminMembers({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        status: requestUrl.searchParams.get("status"),
        sourceType: requestUrl.searchParams.get("sourceType"),
        search: requestUrl.searchParams.get("search"),
        startDate: requestUrl.searchParams.get("startDate"),
        endDate: requestUrl.searchParams.get("endDate"),
        rangeDays: requestUrl.searchParams.get("rangeDays"),
        page: requestUrl.searchParams.get("page"),
        pageSize: requestUrl.searchParams.get("pageSize"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/admin/members") {
      const body = await readJsonBody(req);
      if (!(await ensureAdminRequestAccess(req, res, requestUrl, body.groupId))) {
        return;
      }
      const result = await updateAdminMemberReview({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PATCH" && requestUrl.pathname === "/api/admin/members/status") {
      const body = await readJsonBody(req);
      if (!(await ensureAdminRequestAccess(req, res, requestUrl, body.groupId))) {
        return;
      }
      const result = await updateAdminMemberStatus({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/content/export") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await exportAdminContent({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        status: requestUrl.searchParams.get("status"),
        type: requestUrl.searchParams.get("type"),
        reviewStatus: requestUrl.searchParams.get("reviewStatus"),
        reportStatus: requestUrl.searchParams.get("reportStatus"),
        columnId: requestUrl.searchParams.get("columnId"),
        search: requestUrl.searchParams.get("search"),
        startDate: requestUrl.searchParams.get("startDate"),
        endDate: requestUrl.searchParams.get("endDate"),
        rangeDays: requestUrl.searchParams.get("rangeDays"),
        page: requestUrl.searchParams.get("page"),
        pageSize: requestUrl.searchParams.get("pageSize"),
        scope: requestUrl.searchParams.get("scope"),
      });
      if (result.contentType) {
        sendText(res, result.statusCode, result.payload, result.contentType, {
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName || "content-report.csv")}`,
        });
      } else {
        sendJson(res, result.statusCode, result.payload);
      }
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/content") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminContent({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        status: requestUrl.searchParams.get("status"),
        type: requestUrl.searchParams.get("type"),
        reviewStatus: requestUrl.searchParams.get("reviewStatus"),
        reportStatus: requestUrl.searchParams.get("reportStatus"),
        columnId: requestUrl.searchParams.get("columnId"),
        search: requestUrl.searchParams.get("search"),
        startDate: requestUrl.searchParams.get("startDate"),
        endDate: requestUrl.searchParams.get("endDate"),
        rangeDays: requestUrl.searchParams.get("rangeDays"),
        page: requestUrl.searchParams.get("page"),
        pageSize: requestUrl.searchParams.get("pageSize"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/scoreboard") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminScoreboard({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        memberStatus: requestUrl.searchParams.get("memberStatus"),
        search: requestUrl.searchParams.get("search"),
        rangeDays: requestUrl.searchParams.get("rangeDays"),
        page: requestUrl.searchParams.get("page"),
        pageSize: requestUrl.searchParams.get("pageSize"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/admin/scoreboard") {
      const body = await readJsonBody(req);
      if (!(await ensureAdminRequestAccess(req, res, requestUrl, body.groupId))) {
        return;
      }
      const result = await updateAdminScoreboard({
        ...body,
        sessionToken: req.headers["x-session-token"],
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/member-verification") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminMemberVerification({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        verifyType: requestUrl.searchParams.get("verifyType"),
        keyword: requestUrl.searchParams.get("keyword"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/member-verification/check") {
      const result = await getMemberVerificationCheck({
        groupId: requestUrl.searchParams.get("groupId"),
        verifyType: requestUrl.searchParams.get("verifyType"),
        keyword: requestUrl.searchParams.get("keyword"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/admin/content") {
      const body = await readJsonBody(req);
      const result = await updateAdminContent({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/courses") {
      const adminAccess = await ensureWebBossRequestAccess(req, res, requestUrl);
      if (!adminAccess) {
        return;
      }
      const result = await listAdminCourses({
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        adminUserId: adminAccess.userId,
        status: requestUrl.searchParams.get("status"),
        search: requestUrl.searchParams.get("search"),
        page: requestUrl.searchParams.get("page"),
        pageSize: requestUrl.searchParams.get("pageSize"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/courses/detail") {
      const adminAccess = await ensureWebBossRequestAccess(req, res, requestUrl);
      if (!adminAccess) {
        return;
      }
      const result = await getAdminCourseDetail({
        courseId: requestUrl.searchParams.get("courseId"),
        id: requestUrl.searchParams.get("id"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        adminUserId: adminAccess.userId,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/admin/courses") {
      const body = await readJsonBody(req);
      const adminAccess = await ensureWebBossRequestAccess(req, res, requestUrl);
      if (!adminAccess) {
        return;
      }
      const result = await saveAdminCourse({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        adminUserId: adminAccess.userId,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/admin/courses") {
      const body = await readJsonBody(req);
      const adminAccess = await ensureWebBossRequestAccess(req, res, requestUrl);
      if (!adminAccess) {
        return;
      }
      const result = await saveAdminCourse({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        adminUserId: adminAccess.userId,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PATCH" && requestUrl.pathname === "/api/admin/courses/status") {
      const body = await readJsonBody(req);
      const adminAccess = await ensureWebBossRequestAccess(req, res, requestUrl);
      if (!adminAccess) {
        return;
      }
      const result = await updateAdminCourseStatus({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        adminUserId: adminAccess.userId,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/admin/course-lessons") {
      const body = await readJsonBody(req);
      const adminAccess = await ensureWebBossRequestAccess(req, res, requestUrl);
      if (!adminAccess) {
        return;
      }
      const result = await saveAdminCourseLesson({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        adminUserId: adminAccess.userId,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/admin/course-lessons") {
      const body = await readJsonBody(req);
      const adminAccess = await ensureWebBossRequestAccess(req, res, requestUrl);
      if (!adminAccess) {
        return;
      }
      const result = await saveAdminCourseLesson({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        adminUserId: adminAccess.userId,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PATCH" && requestUrl.pathname === "/api/admin/course-lessons/status") {
      const body = await readJsonBody(req);
      const adminAccess = await ensureWebBossRequestAccess(req, res, requestUrl);
      if (!adminAccess) {
        return;
      }
      const result = await updateAdminCourseLessonStatus({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        adminUserId: adminAccess.userId,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PATCH" && requestUrl.pathname === "/api/admin/course-lessons/reorder") {
      const body = await readJsonBody(req);
      const adminAccess = await ensureWebBossRequestAccess(req, res, requestUrl);
      if (!adminAccess) {
        return;
      }
      const result = await reorderAdminCourseLessons({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
        adminUserId: adminAccess.userId,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/permissions") {
      if (!(await ensureAdminRequestAccess(req, res, requestUrl))) {
        return;
      }
      const result = await getAdminPermissions({
        groupId: requestUrl.searchParams.get("groupId"),
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "PUT" && requestUrl.pathname === "/api/admin/permissions") {
      const body = await readJsonBody(req);
      const result = await updateAdminPermissions({
        ...body,
        sessionToken: req.headers["x-session-token"] || body.sessionToken,
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/") {
      sendJson(res, 200, {
        ok: true,
        service: "xueyin-backend",
        endpoints: [
          "/health",
          "/schema",
          "/api/admin/income",
          "/api/admin/promotion",
          "/api/auth/login",
          "/api/auth/web-mobile-login",
          "/api/auth/session?sessionToken=<token>",
          "/api/auth/logout",
          "/api/planets/joined?sessionToken=<token>",
          "/api/planets/discover?sessionToken=<token>&limit=12",
          "/api/planets/home?groupId=<groupId>&sessionToken=<token>",
          "/api/planets/members?groupId=<groupId>&sessionToken=<token>",
          "/api/planets/posts?groupId=<groupId>&tab=latest&limit=20",
          "/api/checkin/challenges?groupId=<groupId>&status=ongoing&sessionToken=<token>",
          "/api/checkin/challenges/detail?challengeId=<challengeId>&sessionToken=<token>",
          "/api/checkin/rankings?challengeId=<challengeId>&sessionToken=<token>",
          "/api/checkin/records?challengeId=<challengeId>&year=2026&month=4&day=3&sessionToken=<token>",
          "/api/checkin/challenges/join",
          "/api/checkin/posts",
          "/api/planets/columns?groupId=<groupId>&sessionToken=<token>",
          "/api/planets/columns",
          "/api/planets/columns/detail?columnId=<columnId>&groupId=<groupId>&sessionToken=<token>",
          "/api/planets/pinned-posts?groupId=<groupId>",
          "/api/planets/posts",
          "/api/planets/posts/assign-column",
          "/api/planets/subscription",
          "/api/planets/posts/delete",
          "/api/planets/my-posts?sessionToken=<token>",
          "/api/articles?groupId=<groupId>&status=PUBLISHED&page=1&pageSize=20",
          "/api/articles/detail?articleId=<articleId>",
          "/api/articles",
          "/api/articles/status",
          "/api/posts/detail?postId=<postId>",
          "/api/posts/comments?postId=<postId>",
          "/api/posts/comments",
          "/api/posts/like",
          "/api/posts/report",
          "/api/comments/like",
          "/api/planets/preview?groupId=grp_datawhale_001&userId=usr_buyer_001&couponCode=NEW1000&channelCode=CH_WECHAT_MENU_001",
          "/api/planets/profile",
          "/api/orders/join",
          "/api/orders/renewal",
          "/api/payments/wechat/notify",
          "/pay/notify",
          "/api/payments/mock-callback",
          "/api/orders/detail?orderNo=<orderNo>",
          "/api/memberships/status?groupId=grp_datawhale_001&userId=usr_buyer_001",
          "/api/debug/state",
          "/api/ai/ask",
          "/api/kb/search?q=<query>&limit=8&topic=金融货币",
        ],
      });
      return;
    }

    sendJson(res, 404, {
      ok: false,
      message: "Not Found",
      path: requestUrl.pathname,
    });
  } catch (error) {
    console.error("[request] unhandled error", error);
    const mappedError = mapErrorToResponse(error);
    sendJson(res, mappedError.statusCode, {
      ok: false,
      message: mappedError.message,
    });
  }
});

function listenServer() {
  return new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off("listening", handleListening);
      if (error && error.code === "EADDRINUSE") {
        reject(new Error(`端口 ${PORT} 已被占用，请先停止已有后端实例，或修改 PORT 后重试`));
        return;
      }
      reject(error);
    };

    const handleListening = () => {
      server.off("error", handleError);
      console.log(`xueyin-backend listening on http://${HOST}:${PORT}`);
      resolve();
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(PORT, HOST);
  });
}

function logWechatPayReadiness() {
  const diagnostics = inspectWechatPayReadiness();
  const modeSuffix = diagnostics.mode === "partner" ? "partner" : "direct";
  const identityText =
    diagnostics.mode === "partner"
      ? `spAppId=${diagnostics.spAppId || "-"} spMchId=${diagnostics.spMchId || "-"} subAppId=${
          diagnostics.subAppId || "-"
        } subMchId=${diagnostics.subMchId || "-"}`
      : `appId=${diagnostics.appId || "-"} mchId=${diagnostics.mchId || "-"}`;

  if (diagnostics.ready) {
    const privateKeySuffix = diagnostics.privateKeyMode === "inline" ? "inline" : diagnostics.privateKeyPath || "unknown";
    console.log(
      `[wechat-pay] ready mode=${modeSuffix} ${identityText} notifyUrl=${diagnostics.notifyUrl} privateKey=${privateKeySuffix}`
    );
    return;
  }

  console.warn(
    `[wechat-pay] not ready mode=${modeSuffix} ${identityText} notifyUrl=${diagnostics.notifyUrl || "-"} message=${
      diagnostics.message
    }`
  );
}

async function start() {
  ensureUploadDir();
  if (shouldStartBackgroundJobs()) {
    startAccessTokenRefreshScheduler();
    startMallOrderAutoCloseScheduler();
    startMallOrderAutoReceiveScheduler();
  } else {
    console.log("[scheduler] background jobs disabled by XUEYIN_BACKGROUND_JOBS=0");
  }
  logWechatPayReadiness();
  await listenServer();
}

start().catch(async (error) => {
  console.error("failed to start xueyin-backend", error);
  await prisma.$disconnect();
  process.exit(1);
});
