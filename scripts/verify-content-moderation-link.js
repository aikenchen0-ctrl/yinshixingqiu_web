const args = new Set(process.argv.slice(2));

const GROUP_ID = "grp_datawhale_001";
const BUYER_MOBILE = "13800000001";
const OWNER_MOBILE = "13800000002";
const AUTHOR_PENDING_POST_ID = "pst_author_report_pending_001";
const OWNER_PENDING_POST_ID = "pst_featured_001";
const HIDE_RESOLVE_NOTE = "已先隐藏该内容，请删除导流链接后重新发布。";
const IGNORE_NOTE = "已复核，当前内容暂不做下架处理。";
const SHOULD_RESET_DEMO_DATA =
  process.env.VERIFY_CONTENT_MODERATION_RESET === "1" || args.has("--reset-demo-data");

const { prisma } = require("../backend/src/db/prisma");
const { ensureDemoData } = require("../backend/src/db/seedDemoData");
const { loginWebByMobile } = require("../backend/src/services/authService");
const {
  getAdminMembers,
  getAdminContent,
  getAdminScoreboard,
  getAdminMemberVerification,
  getMemberVerificationCheck,
  getAdminIncome,
  getAdminRenewal,
  getAdminPromotion,
  getAdminPromotionChannels,
  getAdminCoupons,
  getAdminRenewalNotices,
  getAdminRenewalSettings,
  getAdminPermissions,
  exportAdminMembers,
  exportAdminContent,
  updateAdminContent,
} = require("../backend/src/services/adminService");
const { listMyPosts, getPostDetail } = require("../backend/src/services/contentService");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findItemById(items, id, context) {
  const item = Array.isArray(items) ? items.find((entry) => entry && entry.id === id) : null;
  assert(item, `${context} 中缺少 ${id}`);
  return item;
}

function assertFieldAbsent(value, fieldName, context) {
  if (!value || typeof value !== "object") {
    return;
  }

  assert(
    !Object.prototype.hasOwnProperty.call(value, fieldName),
    `${context} 不应包含字段 ${fieldName}`
  );
}

function assertStatusCode(result, expectedStatusCode, context) {
  assert(result && result.statusCode === expectedStatusCode, `${context} 状态码异常: ${result ? result.statusCode : "unknown"}`);
}

function stripUtf8Bom(value) {
  return String(value || "").replace(/^\uFEFF/, "");
}

async function loginByMobile(mobile, label) {
  const result = await loginWebByMobile({ mobile });
  assert(result.statusCode === 200 && result.payload && result.payload.ok, `${label} 登录失败`);
  const sessionToken = result.payload.data && result.payload.data.sessionToken;
  assert(sessionToken, `${label} 未返回 sessionToken`);
  return sessionToken;
}

async function loadAdminContentPayload(sessionToken, reportStatus, context) {
  const result = await getAdminContent({
    groupId: GROUP_ID,
    sessionToken,
    reportStatus,
    page: 1,
    pageSize: 50,
  });
  assert(result.statusCode === 200 && result.payload && result.payload.ok, `${context} 调用失败`);
  return result.payload.data;
}

async function loadAdminContent(sessionToken, reportStatus, context) {
  const payload = await loadAdminContentPayload(sessionToken, reportStatus, context);
  return Array.isArray(payload && payload.items) ? payload.items : [];
}

function assertItemMissing(items, id, context) {
  const exists = Array.isArray(items) ? items.some((entry) => entry && entry.id === id) : false;
  assert(!exists, `${context} 中不应包含 ${id}`);
}

function buildContentReportSummarySnapshot(payload) {
  const summary = payload && payload.summary ? payload.summary : {};
  return {
    pending: Number(summary.reportPending || 0),
    resolved: Number(summary.reportResolved || 0),
    ignored: Number(summary.reportIgnored || 0),
    total: Number(summary.reportTotal || 0),
  };
}

function assertSummaryDelta(beforeSummary, afterSummary, expectedDelta, context) {
  const keys = ["pending", "resolved", "ignored", "total"];
  keys.forEach((key) => {
    const delta = Number(expectedDelta[key] || 0);
    const beforeValue = Number(beforeSummary[key] || 0);
    const afterValue = Number(afterSummary[key] || 0);
    assert(
      afterValue - beforeValue === delta,
      `${context} 的 ${key} 统计变化异常: before=${beforeValue}, after=${afterValue}, expectedDelta=${delta}`
    );
  });
}

async function loadAuthorPostDetail(sessionToken, postId, context) {
  const result = await getPostDetail(postId, {
    sessionToken,
    incrementRead: false,
  });
  assert(result.statusCode === 200 && result.payload && result.payload.ok, `${context} 详情加载失败`);
  return result.payload.data;
}

async function loadAuthorMyPost(sessionToken, postId, context) {
  const result = await listMyPosts(sessionToken);
  assert(result.statusCode === 200 && result.payload && result.payload.ok, `${context} 我的主题加载失败`);
  const items = Array.isArray(result.payload.data) ? result.payload.data : [];
  return findItemById(items, postId, `${context} 我的主题`);
}

async function restoreSeedState() {
  await ensureDemoData({ resetRuntime: false });
}

async function verifyAdminResourceReadAccess(ownerSessionToken, buyerSessionToken, summary) {
  const unauthorizedContent = await getAdminContent({
    groupId: GROUP_ID,
    reportStatus: "ALL",
    page: 1,
    pageSize: 20,
  });
  assertStatusCode(unauthorizedContent, 401, "未登录内容报表");

  const unauthorizedMembers = await getAdminMembers({
    groupId: GROUP_ID,
    page: 1,
    pageSize: 20,
  });
  assertStatusCode(unauthorizedMembers, 401, "未登录成员报表");

  const unauthorizedContentExport = await exportAdminContent({
    groupId: GROUP_ID,
    scope: "current",
    page: 1,
    pageSize: 20,
  });
  assertStatusCode(unauthorizedContentExport, 401, "未登录内容导出");

  const unauthorizedMemberExport = await exportAdminMembers({
    groupId: GROUP_ID,
    scope: "current",
    page: 1,
    pageSize: 20,
  });
  assertStatusCode(unauthorizedMemberExport, 401, "未登录成员导出");

  const forbiddenContent = await getAdminContent({
    groupId: GROUP_ID,
    sessionToken: buyerSessionToken,
    reportStatus: "ALL",
    page: 1,
    pageSize: 20,
  });
  assertStatusCode(forbiddenContent, 403, "非管理员内容报表");

  const forbiddenMembers = await getAdminMembers({
    groupId: GROUP_ID,
    sessionToken: buyerSessionToken,
    page: 1,
    pageSize: 20,
  });
  assertStatusCode(forbiddenMembers, 403, "非管理员成员报表");

  const forbiddenContentExport = await exportAdminContent({
    groupId: GROUP_ID,
    sessionToken: buyerSessionToken,
    scope: "current",
    page: 1,
    pageSize: 20,
  });
  assertStatusCode(forbiddenContentExport, 403, "非管理员内容导出");

  const forbiddenMemberExport = await exportAdminMembers({
    groupId: GROUP_ID,
    sessionToken: buyerSessionToken,
    scope: "current",
    page: 1,
    pageSize: 20,
  });
  assertStatusCode(forbiddenMemberExport, 403, "非管理员成员导出");

  const ownerContent = await getAdminContent({
    groupId: GROUP_ID,
    sessionToken: ownerSessionToken,
    reportStatus: "ALL",
    page: 1,
    pageSize: 20,
  });
  assertStatusCode(ownerContent, 200, "管理员内容报表");
  assert(ownerContent.payload && ownerContent.payload.ok, "管理员内容报表未返回 ok=true");

  const ownerMembers = await getAdminMembers({
    groupId: GROUP_ID,
    sessionToken: ownerSessionToken,
    page: 1,
    pageSize: 20,
  });
  assertStatusCode(ownerMembers, 200, "管理员成员报表");
  assert(ownerMembers.payload && ownerMembers.payload.ok, "管理员成员报表未返回 ok=true");

  const ownerContentExport = await exportAdminContent({
    groupId: GROUP_ID,
    sessionToken: ownerSessionToken,
    scope: "current",
    page: 1,
    pageSize: 20,
  });
  assertStatusCode(ownerContentExport, 200, "管理员内容导出");
  assert(ownerContentExport.contentType === "text/csv; charset=utf-8", "管理员内容导出 contentType 异常");
  assert(stripUtf8Bom(ownerContentExport.payload).indexOf("主题,作者,类型,状态") === 0, "管理员内容导出表头异常");

  const ownerMemberExport = await exportAdminMembers({
    groupId: GROUP_ID,
    sessionToken: ownerSessionToken,
    scope: "current",
    page: 1,
    pageSize: 20,
  });
  assertStatusCode(ownerMemberExport, 200, "管理员成员导出");
  assert(ownerMemberExport.contentType === "text/csv; charset=utf-8", "管理员成员导出 contentType 异常");
  assert(stripUtf8Bom(ownerMemberExport.payload).indexOf("成员编号,用户昵称,角色,状态") === 0, "管理员成员导出表头异常");

  summary.access = {
    unauthorized: {
      content: unauthorizedContent.statusCode,
      members: unauthorizedMembers.statusCode,
      contentExport: unauthorizedContentExport.statusCode,
      memberExport: unauthorizedMemberExport.statusCode,
    },
    member: {
      content: forbiddenContent.statusCode,
      members: forbiddenMembers.statusCode,
      contentExport: forbiddenContentExport.statusCode,
      memberExport: forbiddenMemberExport.statusCode,
    },
    manager: {
      content: ownerContent.statusCode,
      members: ownerMembers.statusCode,
      contentExport: ownerContentExport.statusCode,
      memberExport: ownerMemberExport.statusCode,
    },
  };
}

async function verifyExtendedAdminReadAccess(ownerSessionToken, buyerSessionToken, summary) {
  const memberVerificationKeyword = "1";
  const protectedCases = [
    {
      key: "scoreboard",
      run: (sessionToken) =>
        getAdminScoreboard({
          groupId: GROUP_ID,
          sessionToken,
          page: 1,
          pageSize: 20,
          rangeDays: 7,
        }),
    },
    {
      key: "memberVerification",
      run: (sessionToken) =>
        getAdminMemberVerification({
          groupId: GROUP_ID,
          sessionToken,
          verifyType: "MEMBER_NO",
          keyword: memberVerificationKeyword,
        }),
    },
    {
      key: "income",
      run: (sessionToken) =>
        getAdminIncome({
          groupId: GROUP_ID,
          sessionToken,
          page: 1,
          pageSize: 20,
          rangeDays: 7,
        }),
    },
    {
      key: "renewal",
      run: (sessionToken) =>
        getAdminRenewal({
          groupId: GROUP_ID,
          sessionToken,
          page: 1,
          pageSize: 20,
          rangeDays: 7,
        }),
    },
    {
      key: "promotion",
      run: (sessionToken) =>
        getAdminPromotion({
          groupId: GROUP_ID,
          sessionToken,
          page: 1,
          pageSize: 20,
          rangeDays: 7,
        }),
    },
    {
      key: "promotionChannels",
      run: (sessionToken) =>
        getAdminPromotionChannels({
          groupId: GROUP_ID,
          sessionToken,
        }),
    },
    {
      key: "coupons",
      run: (sessionToken) =>
        getAdminCoupons({
          groupId: GROUP_ID,
          sessionToken,
        }),
    },
    {
      key: "renewalNotices",
      run: (sessionToken) =>
        getAdminRenewalNotices({
          groupId: GROUP_ID,
          sessionToken,
        }),
    },
    {
      key: "renewalSettings",
      run: (sessionToken) =>
        getAdminRenewalSettings({
          groupId: GROUP_ID,
          sessionToken,
        }),
    },
    {
      key: "permissions",
      run: (sessionToken) =>
        getAdminPermissions({
          groupId: GROUP_ID,
          sessionToken,
        }),
    },
  ];

  const protectedSummary = {};
  for (const item of protectedCases) {
    const unauthorized = await item.run("");
    assertStatusCode(unauthorized, 401, `${item.key} 未登录访问`);

    const forbidden = await item.run(buyerSessionToken);
    assertStatusCode(forbidden, 403, `${item.key} 非管理员访问`);

    const allowed = await item.run(ownerSessionToken);
    assertStatusCode(allowed, 200, `${item.key} 管理员访问`);
    assert(allowed.payload && allowed.payload.ok, `${item.key} 管理员访问未返回 ok=true`);

    protectedSummary[item.key] = {
      unauthorized: unauthorized.statusCode,
      member: forbidden.statusCode,
      manager: allowed.statusCode,
    };
  }

  const publicVerification = await getMemberVerificationCheck({
    groupId: GROUP_ID,
    verifyType: "MEMBER_NO",
    keyword: memberVerificationKeyword,
  });
  assertStatusCode(publicVerification, 200, "公共 member verification check");
  assert(publicVerification.payload && publicVerification.payload.ok, "公共 member verification check 未返回 ok=true");
  assert(
      publicVerification.payload.data &&
        publicVerification.payload.data.matched === true &&
        publicVerification.payload.data.member &&
        publicVerification.payload.data.member.memberNo === 1,
    "公共 member verification check 结果异常"
  );

  summary.extendedAccess = protectedSummary;
  summary.publicVerificationCheck = {
    statusCode: publicVerification.statusCode,
    matched: publicVerification.payload.data.matched,
    memberNo: publicVerification.payload.data.member
      ? publicVerification.payload.data.member.memberNo
      : null,
  };
}

async function verifyHideResolveFlow(ownerSessionToken, buyerSessionToken, summary) {
  const beforeAllPayload = await loadAdminContentPayload(ownerSessionToken, "ALL", "hideResolve 前置后台汇总");
  const beforeAllSummary = buildContentReportSummarySnapshot(beforeAllPayload);
  const pendingItems = await loadAdminContent(ownerSessionToken, "PENDING", "hideResolve 前置后台内容");
  const pendingItem = findItemById(pendingItems, AUTHOR_PENDING_POST_ID, "hideResolve 待处理列表");
  assert(pendingItem.status === "PUBLISHED", "hideResolve 前置状态异常");
  assert(pendingItem.reportPendingCount === 2, "hideResolve 前置待处理举报数异常");
  const beforeResolvedItems = await loadAdminContent(ownerSessionToken, "RESOLVED", "hideResolve 前置已处理内容");
  assertItemMissing(beforeResolvedItems, AUTHOR_PENDING_POST_ID, "hideResolve 前置已处理列表");

  const beforeAuthorDetail = await loadAuthorPostDetail(
    buyerSessionToken,
    AUTHOR_PENDING_POST_ID,
    "hideResolve 前置作者详情"
  );
  assert(beforeAuthorDetail.status === "PUBLISHED", "hideResolve 前置作者详情状态异常");
  assert(
    beforeAuthorDetail.viewerModeration &&
      beforeAuthorDetail.viewerModeration.role === "AUTHOR" &&
      beforeAuthorDetail.viewerModeration.reportStatus === "PENDING" &&
      Number(beforeAuthorDetail.viewerModeration.reportPendingCount || 0) === 2,
    "hideResolve 前置作者详情投诉状态异常"
  );
  assertFieldAbsent(beforeAuthorDetail.metadata, "reportLogs", "hideResolve 前置作者详情 metadata");
  assertFieldAbsent(beforeAuthorDetail.metadata, "reportStatus", "hideResolve 前置作者详情 metadata");

  const updateResult = await updateAdminContent({
    postId: AUTHOR_PENDING_POST_ID,
    sessionToken: ownerSessionToken,
    status: "HIDDEN",
    reportStatus: "RESOLVED",
    reportResolutionNote: HIDE_RESOLVE_NOTE,
  });
  assert(updateResult.statusCode === 200 && updateResult.payload && updateResult.payload.ok, "hideResolve 更新失败");
  assert(updateResult.payload.data.status === "HIDDEN", "hideResolve 更新后状态异常");
  assert(updateResult.payload.data.reportStatus === "RESOLVED", "hideResolve 更新后举报状态异常");
  assert(updateResult.payload.data.reportPendingCount === 0, "hideResolve 更新后仍有待处理举报");

  const afterAllPayload = await loadAdminContentPayload(ownerSessionToken, "ALL", "hideResolve 后置后台汇总");
  const afterAllSummary = buildContentReportSummarySnapshot(afterAllPayload);
  assertSummaryDelta(
    beforeAllSummary,
    afterAllSummary,
    { pending: -1, resolved: 1, ignored: 0, total: 0 },
    "hideResolve 汇总卡片"
  );

  const pendingItemsAfter = await loadAdminContent(ownerSessionToken, "PENDING", "hideResolve 后置待处理内容");
  assertItemMissing(pendingItemsAfter, AUTHOR_PENDING_POST_ID, "hideResolve 后置待处理列表");
  const resolvedItems = await loadAdminContent(ownerSessionToken, "RESOLVED", "hideResolve 后置后台内容");
  const resolvedItem = findItemById(resolvedItems, AUTHOR_PENDING_POST_ID, "hideResolve 已处理列表");
  assert(resolvedItem.status === "HIDDEN", "hideResolve 已处理列表状态异常");
  assert(resolvedItem.reportResolutionNote === HIDE_RESOLVE_NOTE, "hideResolve 已处理备注异常");

  const afterAuthorMyPost = await loadAuthorMyPost(
    buyerSessionToken,
    AUTHOR_PENDING_POST_ID,
    "hideResolve 后置作者视角"
  );
  assert(afterAuthorMyPost.status === "HIDDEN", "hideResolve 后置我的主题状态异常");
  assert(
    afterAuthorMyPost.viewerModeration &&
      afterAuthorMyPost.viewerModeration.reportStatus === "RESOLVED" &&
      afterAuthorMyPost.viewerModeration.reportResolutionNote === HIDE_RESOLVE_NOTE,
    "hideResolve 后置我的主题投诉状态异常"
  );

  const afterAuthorDetail = await loadAuthorPostDetail(
    buyerSessionToken,
    AUTHOR_PENDING_POST_ID,
    "hideResolve 后置作者详情"
  );
  assert(afterAuthorDetail.status === "HIDDEN", "hideResolve 后置作者详情状态异常");
  assert(
    afterAuthorDetail.viewerModeration &&
      afterAuthorDetail.viewerModeration.role === "AUTHOR" &&
      afterAuthorDetail.viewerModeration.reportStatus === "RESOLVED" &&
      afterAuthorDetail.viewerModeration.reportResolutionNote === HIDE_RESOLVE_NOTE,
    "hideResolve 后置作者详情 viewerModeration 异常"
  );
  assert(
    String(afterAuthorDetail.viewerModeration.message || "").indexOf(HIDE_RESOLVE_NOTE) >= 0,
    "hideResolve 后置作者详情未带处理说明"
  );
  assertFieldAbsent(afterAuthorDetail.metadata, "reportLogs", "hideResolve 后置作者详情 metadata");
  assertFieldAbsent(afterAuthorDetail.metadata, "reportStatus", "hideResolve 后置作者详情 metadata");
  assertFieldAbsent(afterAuthorDetail.viewerModeration, "reportLogs", "hideResolve 后置作者详情 viewerModeration");
  assertFieldAbsent(afterAuthorDetail.viewerModeration, "reporterName", "hideResolve 后置作者详情 viewerModeration");
  assertFieldAbsent(afterAuthorDetail.viewerModeration, "reporterUserId", "hideResolve 后置作者详情 viewerModeration");

  summary.hideResolve = {
    postId: AUTHOR_PENDING_POST_ID,
    finalStatus: afterAuthorDetail.status,
    finalReportStatus: afterAuthorDetail.viewerModeration.reportStatus,
    finalMessage: afterAuthorDetail.viewerModeration.message,
    summaryDelta: {
      pending: afterAllSummary.pending - beforeAllSummary.pending,
      resolved: afterAllSummary.resolved - beforeAllSummary.resolved,
      ignored: afterAllSummary.ignored - beforeAllSummary.ignored,
      total: afterAllSummary.total - beforeAllSummary.total,
    },
  };
}

async function verifyIgnoreFlow(ownerSessionToken, summary) {
  const beforeAllPayload = await loadAdminContentPayload(ownerSessionToken, "ALL", "ignore 前置后台汇总");
  const beforeAllSummary = buildContentReportSummarySnapshot(beforeAllPayload);
  const pendingItems = await loadAdminContent(ownerSessionToken, "PENDING", "ignore 前置后台内容");
  const pendingItem = findItemById(pendingItems, OWNER_PENDING_POST_ID, "ignore 待处理列表");
  assert(pendingItem.status === "PUBLISHED", "ignore 前置状态异常");
  assert(pendingItem.reportPendingCount === 2, "ignore 前置待处理举报数异常");
  const beforeIgnoredItems = await loadAdminContent(ownerSessionToken, "IGNORED", "ignore 前置已忽略内容");
  assertItemMissing(beforeIgnoredItems, OWNER_PENDING_POST_ID, "ignore 前置已忽略列表");

  const beforeOwnerDetail = await loadAuthorPostDetail(
    ownerSessionToken,
    OWNER_PENDING_POST_ID,
    "ignore 前置作者详情"
  );
  assert(beforeOwnerDetail.status === "PUBLISHED", "ignore 前置作者详情状态异常");
  assert(
    beforeOwnerDetail.viewerModeration &&
      beforeOwnerDetail.viewerModeration.role === "AUTHOR" &&
      beforeOwnerDetail.viewerModeration.reportStatus === "PENDING" &&
      Number(beforeOwnerDetail.viewerModeration.reportPendingCount || 0) === 2,
    "ignore 前置作者详情投诉状态异常"
  );

  const updateResult = await updateAdminContent({
    postId: OWNER_PENDING_POST_ID,
    sessionToken: ownerSessionToken,
    status: "PUBLISHED",
    reportStatus: "IGNORED",
    reportResolutionNote: IGNORE_NOTE,
  });
  assert(updateResult.statusCode === 200 && updateResult.payload && updateResult.payload.ok, "ignore 更新失败");
  assert(updateResult.payload.data.status === "PUBLISHED", "ignore 更新后状态异常");
  assert(updateResult.payload.data.reportStatus === "IGNORED", "ignore 更新后举报状态异常");
  assert(updateResult.payload.data.reportPendingCount === 0, "ignore 更新后仍有待处理举报");

  const afterAllPayload = await loadAdminContentPayload(ownerSessionToken, "ALL", "ignore 后置后台汇总");
  const afterAllSummary = buildContentReportSummarySnapshot(afterAllPayload);
  assertSummaryDelta(
    beforeAllSummary,
    afterAllSummary,
    { pending: -1, resolved: 0, ignored: 1, total: 0 },
    "ignore 汇总卡片"
  );

  const pendingItemsAfter = await loadAdminContent(ownerSessionToken, "PENDING", "ignore 后置待处理内容");
  assertItemMissing(pendingItemsAfter, OWNER_PENDING_POST_ID, "ignore 后置待处理列表");
  const ignoredItems = await loadAdminContent(ownerSessionToken, "IGNORED", "ignore 后置后台内容");
  const ignoredItem = findItemById(ignoredItems, OWNER_PENDING_POST_ID, "ignore 已忽略列表");
  assert(ignoredItem.status === "PUBLISHED", "ignore 已忽略列表状态异常");
  assert(ignoredItem.reportResolutionNote === IGNORE_NOTE, "ignore 已忽略备注异常");

  const afterOwnerMyPost = await loadAuthorMyPost(ownerSessionToken, OWNER_PENDING_POST_ID, "ignore 后置作者视角");
  assert(afterOwnerMyPost.status === "PUBLISHED", "ignore 后置我的主题状态异常");
  assert(
    afterOwnerMyPost.viewerModeration &&
      afterOwnerMyPost.viewerModeration.reportStatus === "IGNORED" &&
      afterOwnerMyPost.viewerModeration.reportResolutionNote === IGNORE_NOTE,
    "ignore 后置我的主题投诉状态异常"
  );

  const afterOwnerDetail = await loadAuthorPostDetail(
    ownerSessionToken,
    OWNER_PENDING_POST_ID,
    "ignore 后置作者详情"
  );
  assert(afterOwnerDetail.status === "PUBLISHED", "ignore 后置作者详情状态异常");
  assert(
    afterOwnerDetail.viewerModeration &&
      afterOwnerDetail.viewerModeration.role === "AUTHOR" &&
      afterOwnerDetail.viewerModeration.reportStatus === "IGNORED" &&
      afterOwnerDetail.viewerModeration.reportResolutionNote === IGNORE_NOTE,
    "ignore 后置作者详情 viewerModeration 异常"
  );
  assert(
    String(afterOwnerDetail.viewerModeration.message || "").indexOf(IGNORE_NOTE) >= 0,
    "ignore 后置作者详情未带处理说明"
  );
  assertFieldAbsent(afterOwnerDetail.metadata, "reportLogs", "ignore 后置作者详情 metadata");
  assertFieldAbsent(afterOwnerDetail.metadata, "reportStatus", "ignore 后置作者详情 metadata");
  assertFieldAbsent(afterOwnerDetail.viewerModeration, "reportLogs", "ignore 后置作者详情 viewerModeration");
  assertFieldAbsent(afterOwnerDetail.viewerModeration, "reporterName", "ignore 后置作者详情 viewerModeration");
  assertFieldAbsent(afterOwnerDetail.viewerModeration, "reporterUserId", "ignore 后置作者详情 viewerModeration");

  summary.ignore = {
    postId: OWNER_PENDING_POST_ID,
    finalStatus: afterOwnerDetail.status,
    finalReportStatus: afterOwnerDetail.viewerModeration.reportStatus,
    finalMessage: afterOwnerDetail.viewerModeration.message,
    summaryDelta: {
      pending: afterAllSummary.pending - beforeAllSummary.pending,
      resolved: afterAllSummary.resolved - beforeAllSummary.resolved,
      ignored: afterAllSummary.ignored - beforeAllSummary.ignored,
      total: afterAllSummary.total - beforeAllSummary.total,
    },
  };
}

async function main() {
  await ensureDemoData({ resetRuntime: SHOULD_RESET_DEMO_DATA });

  const summary = {
    ok: true,
    groupId: GROUP_ID,
    resetDemoData: SHOULD_RESET_DEMO_DATA,
    scenarios: {},
  };

  const buyerSessionToken = await loginByMobile(BUYER_MOBILE, "buyer");
  const ownerSessionToken = await loginByMobile(OWNER_MOBILE, "owner");

  await verifyAdminResourceReadAccess(ownerSessionToken, buyerSessionToken, summary.scenarios);
  await verifyExtendedAdminReadAccess(ownerSessionToken, buyerSessionToken, summary.scenarios);
  await restoreSeedState();
  await verifyHideResolveFlow(ownerSessionToken, buyerSessionToken, summary.scenarios);
  await restoreSeedState();
  await verifyIgnoreFlow(ownerSessionToken, summary.scenarios);

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await restoreSeedState();
    } catch (error) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            restoreFailed: true,
            message: error instanceof Error ? error.message : String(error),
          },
          null,
          2
        )
      );
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  });
