const http = require("http");
const https = require("https");

const args = new Set(process.argv.slice(2));
const BASE_URL = String(process.env.SMOKE_API_BASE_URL || "http://127.0.0.1:3000").trim().replace(/\/+$/, "");
const BUYER_MOBILE = String(process.env.SMOKE_BUYER_MOBILE || "13800000001").trim();
const OWNER_MOBILE = String(process.env.SMOKE_OWNER_MOBILE || "13800000002").trim();
const GROUP_ID = String(process.env.SMOKE_GROUP_ID || "grp_datawhale_001").trim();
const TIMEOUT_MS = Number(process.env.SMOKE_API_TIMEOUT_MS || 15000);
const SHOULD_ENSURE_DEMO_DATA =
  process.env.SMOKE_ENSURE_DEMO_DATA === "1" || args.has("--ensure-demo-data") || args.has("--reset-demo-data");
const SHOULD_RESET_DEMO_DATA = process.env.SMOKE_RESET_DEMO_DATA === "1" || args.has("--reset-demo-data");
const AUTHOR_WORKBENCH_POST_IDS = {
  plain: "pst_author_plain_001",
  reviewPending: "pst_author_review_pending_001",
  reviewRejected: "pst_author_review_rejected_001",
  reportPending: "pst_author_report_pending_001",
  hiddenResolved: "pst_author_hidden_resolved_001",
};
const ADMIN_PRIVATE_GET_CASES = [
  {
    key: "admin.content",
    pathname: "/api/admin/content",
    query: {
      groupId: GROUP_ID,
      reportStatus: "ALL",
      page: 1,
      pageSize: 20,
    },
  },
  {
    key: "admin.members",
    pathname: "/api/admin/members",
    query: {
      groupId: GROUP_ID,
      page: 1,
      pageSize: 20,
    },
  },
  {
    key: "admin.scoreboard",
    pathname: "/api/admin/scoreboard",
    query: {
      groupId: GROUP_ID,
      page: 1,
      pageSize: 20,
      rangeDays: 7,
    },
  },
  {
    key: "admin.member-verification",
    pathname: "/api/admin/member-verification",
    query: {
      groupId: GROUP_ID,
      verifyType: "MEMBER_NO",
      keyword: 1,
    },
  },
  {
    key: "admin.income",
    pathname: "/api/admin/income",
    query: {
      groupId: GROUP_ID,
      page: 1,
      pageSize: 20,
      rangeDays: 7,
    },
  },
  {
    key: "admin.renewal",
    pathname: "/api/admin/renewal",
    query: {
      groupId: GROUP_ID,
      page: 1,
      pageSize: 20,
      rangeDays: 7,
    },
  },
  {
    key: "admin.promotion",
    pathname: "/api/admin/promotion",
    query: {
      groupId: GROUP_ID,
      page: 1,
      pageSize: 20,
      rangeDays: 7,
    },
  },
  {
    key: "admin.promotion.channels",
    pathname: "/api/admin/promotion/channels",
    query: {
      groupId: GROUP_ID,
    },
  },
  {
    key: "admin.coupons",
    pathname: "/api/admin/coupons",
    query: {
      groupId: GROUP_ID,
    },
  },
  {
    key: "admin.renewal.notices",
    pathname: "/api/admin/renewal/notices",
    query: {
      groupId: GROUP_ID,
    },
  },
  {
    key: "admin.renewal.settings",
    pathname: "/api/admin/renewal/settings",
    query: {
      groupId: GROUP_ID,
    },
  },
  {
    key: "admin.permissions",
    pathname: "/api/admin/permissions",
    query: {
      groupId: GROUP_ID,
    },
  },
];
const ADMIN_PRIVATE_EXPORT_CASES = [
  {
    key: "admin.content.export",
    pathname: "/api/admin/content/export",
    query: {
      groupId: GROUP_ID,
      reportStatus: "ALL",
      page: 1,
      pageSize: 20,
      scope: "current",
    },
    csvHeader: "主题,作者,类型,状态",
  },
  {
    key: "admin.members.export",
    pathname: "/api/admin/members/export",
    query: {
      groupId: GROUP_ID,
      page: 1,
      pageSize: 20,
      scope: "current",
    },
    csvHeader: "成员编号,用户昵称,角色,状态",
  },
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildQuery(params) {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    searchParams.append(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function requestJson(input) {
  const method = String(input.method || "GET").toUpperCase();
  const requestUrl = new URL(`${BASE_URL}${input.pathname}${buildQuery(input.query)}`);
  const isHttps = requestUrl.protocol === "https:";
  const requestLib = isHttps ? https : http;
  const body = input.body === undefined ? "" : JSON.stringify(input.body);

  return new Promise((resolve, reject) => {
    const req = requestLib.request(
      {
        hostname: requestUrl.hostname,
        port: requestUrl.port,
        path: `${requestUrl.pathname}${requestUrl.search}`,
        method,
        headers: {
          Accept: "application/json",
          ...(body
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
              }
            : {}),
          ...(input.headers || {}),
        },
      },
      (res) => {
        let rawBody = "";
        res.setEncoding("utf8");

        res.on("data", (chunk) => {
          rawBody += chunk;
        });

        res.on("end", () => {
          let payload = null;

          try {
            payload = rawBody ? JSON.parse(rawBody) : null;
          } catch (error) {
            reject(new Error(`${method} ${requestUrl.pathname} 返回了无法解析的 JSON: ${rawBody.slice(0, 300)}`));
            return;
          }

          resolve({
            statusCode: res.statusCode || 0,
            payload,
            rawBody,
          });
        });
      }
    );

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy(new Error(`${method} ${requestUrl.pathname} 超时 (${TIMEOUT_MS}ms)`));
    });

    req.on("error", reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

function requestText(input) {
  const method = String(input.method || "GET").toUpperCase();
  const requestUrl = new URL(`${BASE_URL}${input.pathname}${buildQuery(input.query)}`);
  const isHttps = requestUrl.protocol === "https:";
  const requestLib = isHttps ? https : http;
  const body = input.body === undefined ? "" : JSON.stringify(input.body);

  return new Promise((resolve, reject) => {
    const req = requestLib.request(
      {
        hostname: requestUrl.hostname,
        port: requestUrl.port,
        path: `${requestUrl.pathname}${requestUrl.search}`,
        method,
        headers: {
          Accept: "text/csv,application/json",
          ...(body
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
              }
            : {}),
          ...(input.headers || {}),
        },
      },
      (res) => {
        let rawBody = "";
        res.setEncoding("utf8");

        res.on("data", (chunk) => {
          rawBody += chunk;
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            contentType: res.headers["content-type"] || "",
            rawBody,
          });
        });
      }
    );

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy(new Error(`${method} ${requestUrl.pathname} 超时 (${TIMEOUT_MS}ms)`));
    });

    req.on("error", reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

function assertSuccess(response, context, expectedStatusCode) {
  assert(response.statusCode === expectedStatusCode, `${context} 状态码异常: ${response.statusCode}`);
  assert(response.payload && response.payload.ok === true, `${context} 返回 ok=false`);
  return response.payload;
}

function expectArray(value, context) {
  assert(Array.isArray(value), `${context} 返回结果不是数组`);
  return value;
}

function expectNonEmptyStringArray(value, context) {
  const items = expectArray(value, context);
  assert(items.length > 0, `${context} 为空`);
  items.forEach((item, index) => {
    assert(typeof item === "string" && item.trim(), `${context}[${index}] 不是有效字符串`);
  });
  return items;
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

function assertStatusCode(response, expectedStatusCode, context) {
  assert(response.statusCode === expectedStatusCode, `${context} 状态码异常: ${response.statusCode}`);
}

function stripUtf8Bom(value) {
  return String(value || "").replace(/^\uFEFF/, "");
}

function nowDateParts() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

async function runStep(name, handler) {
  const startedAt = Date.now();
  const result = await handler();
  console.log(`[pass] ${name} (${Date.now() - startedAt}ms)`);
  return result;
}

async function loginByMobile(mobile, accountLabel, summary) {
  const payload = await runStep(`auth.web-mobile-login.${accountLabel}`, async () => {
    const response = await requestJson({
      method: "POST",
      pathname: "/api/auth/web-mobile-login",
      body: {
        mobile,
      },
    });
    const result = assertSuccess(response, `/api/auth/web-mobile-login (${accountLabel})`, 200);
    assert(result.data && result.data.sessionToken, `${accountLabel} 登录后未返回 sessionToken`);
    return result;
  });

  await runStep(`auth.session.${accountLabel}`, async () => {
    const response = await requestJson({
      pathname: "/api/auth/session",
      query: {
        sessionToken: payload.data.sessionToken,
      },
    });
    const result = assertSuccess(response, `/api/auth/session (${accountLabel})`, 200);
    assert(result.data && result.data.id === payload.data.id, `${accountLabel} session 用户ID不匹配`);
    return result;
  });

  summary.ids[`${accountLabel}UserId`] = payload.data.id;
  summary.ids[`${accountLabel}SessionTokenPreview`] = `${String(payload.data.sessionToken).slice(0, 8)}...`;
  return payload.data.sessionToken;
}

async function ensureDemoDataIfNeeded() {
  if (!SHOULD_ENSURE_DEMO_DATA) {
    return;
  }

  const { ensureDemoData } = require("../backend/src/db/seedDemoData");
  const { prisma } = require("../backend/src/db/prisma");

  try {
    await ensureDemoData({
      resetRuntime: SHOULD_RESET_DEMO_DATA,
    });
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    `[setup] demo data ensured${SHOULD_RESET_DEMO_DATA ? " (resetRuntime=true)" : ""}`
  );
}

async function main() {
  await ensureDemoDataIfNeeded();

  const summary = {
    ok: true,
    baseUrl: BASE_URL,
    buyerMobile: BUYER_MOBILE,
    ownerMobile: OWNER_MOBILE,
    groupId: GROUP_ID,
    ensuredDemoData: SHOULD_ENSURE_DEMO_DATA,
    resetDemoData: SHOULD_RESET_DEMO_DATA,
    ids: {},
  };

  await runStep("health", async () => {
    const response = await requestJson({
      pathname: "/health",
    });
    const payload = assertSuccess(response, "/health", 200);
    assert(payload.service === "xueyin-backend", "/health service 字段异常");
    summary.healthTime = payload.time;
    return payload;
  });

  const buyerSessionToken = await loginByMobile(BUYER_MOBILE, "buyer", summary);
  const ownerSessionToken = await loginByMobile(OWNER_MOBILE, "owner", summary);

  await runStep("admin.http.private-access", async () => {
    const accessSummary = {};

    for (const item of ADMIN_PRIVATE_GET_CASES) {
      const unauthorized = await requestJson({
        pathname: item.pathname,
        query: item.query,
      });
      assertStatusCode(unauthorized, 401, `${item.key} unauthorized`);

      const forbidden = await requestJson({
        pathname: item.pathname,
        query: item.query,
        headers: {
          "x-session-token": buyerSessionToken,
        },
      });
      assertStatusCode(forbidden, 403, `${item.key} member`);

      const allowed = await requestJson({
        pathname: item.pathname,
        query: item.query,
        headers: {
          "x-session-token": ownerSessionToken,
        },
      });
      const payload = assertSuccess(allowed, item.key, 200);
      accessSummary[item.key] = {
        unauthorized: unauthorized.statusCode,
        member: forbidden.statusCode,
        manager: allowed.statusCode,
        hasData: Boolean(payload.data),
      };
    }

    for (const item of ADMIN_PRIVATE_EXPORT_CASES) {
      const unauthorized = await requestJson({
        pathname: item.pathname,
        query: item.query,
      });
      assertStatusCode(unauthorized, 401, `${item.key} unauthorized`);

      const forbidden = await requestJson({
        pathname: item.pathname,
        query: item.query,
        headers: {
          "x-session-token": buyerSessionToken,
        },
      });
      assertStatusCode(forbidden, 403, `${item.key} member`);

      const allowed = await requestText({
        pathname: item.pathname,
        query: item.query,
        headers: {
          "x-session-token": ownerSessionToken,
        },
      });
      assertStatusCode(allowed, 200, `${item.key} manager`);
      assert(
        String(allowed.contentType || "").includes("text/csv"),
        `${item.key} 返回 content-type 异常: ${allowed.contentType}`
      );
      assert(
        stripUtf8Bom(allowed.rawBody).indexOf(item.csvHeader) === 0,
        `${item.key} CSV 表头异常`
      );
      accessSummary[item.key] = {
        unauthorized: unauthorized.statusCode,
        member: forbidden.statusCode,
        manager: allowed.statusCode,
      };
    }

    const publicVerification = await requestJson({
      pathname: "/api/member-verification/check",
      query: {
        groupId: GROUP_ID,
        verifyType: "MEMBER_NO",
        keyword: 1,
      },
    });
    const publicPayload = assertSuccess(publicVerification, "member-verification.check", 200);
    assert(
      publicPayload.data &&
        publicPayload.data.matched === true &&
        publicPayload.data.member &&
        publicPayload.data.member.memberNo === 1,
      "member-verification.check 返回结果异常"
    );

    summary.adminHttpAccess = accessSummary;
    summary.publicVerificationCheck = {
      statusCode: publicVerification.statusCode,
      matched: publicPayload.data.matched,
      memberNo: publicPayload.data.member ? publicPayload.data.member.memberNo : null,
    };
    return accessSummary;
  });

  await runStep("planets.joined", async () => {
    const response = await requestJson({
      pathname: "/api/planets/joined",
      query: {
        sessionToken: buyerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/planets/joined", 200);
    const items = expectArray(payload.data, "joined planets");
    assert(items.some((item) => item && item.id === GROUP_ID), `joined planets 中缺少 ${GROUP_ID}`);
    summary.joinedCount = items.length;
    return payload;
  });

  await runStep("planets.discover", async () => {
    const response = await requestJson({
      pathname: "/api/planets/discover",
      query: {
        sessionToken: buyerSessionToken,
        limit: 12,
      },
    });
    const payload = assertSuccess(response, "/api/planets/discover", 200);
    const items = expectArray(payload.data, "discover planets");
    assert(!items.some((item) => item && item.id === GROUP_ID), `discover planets 不应包含已加入星球 ${GROUP_ID}`);
    summary.discoverCount = items.length;
    return payload;
  });

  await runStep("planets.discover-featured-posts", async () => {
    const response = await requestJson({
      pathname: "/api/planets/discover-featured-posts",
      query: {
        limit: 12,
      },
      headers: {
        "x-session-token": buyerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/planets/discover-featured-posts", 200);
    const items = expectArray(payload.data, "discover featured posts");
    assert(items.length > 0, "discover featured posts 为空");
    assert(
      !items.some((item) => item && item.group && item.group.id === GROUP_ID),
      `discover featured posts 不应包含已加入星球 ${GROUP_ID}`
    );
    assert(items.every((item) => item && item.status === "PUBLISHED"), "discover featured posts 状态异常");
    summary.discoverFeaturedCount = items.length;
    return payload;
  });

  await runStep("planets.home", async () => {
    const response = await requestJson({
      pathname: "/api/planets/home",
      query: {
        groupId: GROUP_ID,
        sessionToken: buyerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/planets/home", 200);
    assert(payload.data && payload.data.group && payload.data.group.id === GROUP_ID, "home groupId 不匹配");
    summary.groupName = payload.data.group.name;
    return payload;
  });

  const postsPayload = await runStep("planets.posts.latest", async () => {
    const response = await requestJson({
      pathname: "/api/planets/posts",
      query: {
        groupId: GROUP_ID,
        tab: "latest",
        limit: 20,
      },
      headers: {
        "x-session-token": buyerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/planets/posts", 200);
    const items = expectArray(payload.data && payload.data.items, "latest posts");
    assert(items.length > 0, "latest posts 为空");
    summary.postCount = items.length;
    summary.ids.postId = items[0].id;
    return payload;
  });

  await runStep("planets.my-posts", async () => {
    const response = await requestJson({
      pathname: "/api/planets/my-posts",
      query: {
        sessionToken: buyerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/planets/my-posts", 200);
    const items = expectArray(payload.data, "my posts");
    assert(items.length >= 6, `my posts 数量异常: ${items.length}`);

    const plainPost = findItemById(items, AUTHOR_WORKBENCH_POST_IDS.plain, "my posts");
    assert(plainPost.status === "PUBLISHED", "plain my post 状态异常");
    assert(plainPost.viewerModeration === null, "plain my post 不应返回 viewerModeration");

    const reviewPendingPost = findItemById(items, AUTHOR_WORKBENCH_POST_IDS.reviewPending, "my posts");
    assert(reviewPendingPost.status === "DRAFT", "review pending my post 状态异常");
    assert(
      reviewPendingPost.viewerModeration &&
        reviewPendingPost.viewerModeration.reviewStatus === "PENDING",
      "review pending my post 未返回正确的审核状态"
    );

    const reviewRejectedPost = findItemById(items, AUTHOR_WORKBENCH_POST_IDS.reviewRejected, "my posts");
    assert(reviewRejectedPost.status === "DRAFT", "review rejected my post 状态异常");
    assert(
      reviewRejectedPost.viewerModeration &&
        reviewRejectedPost.viewerModeration.reviewStatus === "REJECTED",
      "review rejected my post 未返回正确的审核状态"
    );

    const reportPendingPost = findItemById(items, AUTHOR_WORKBENCH_POST_IDS.reportPending, "my posts");
    assert(reportPendingPost.status === "PUBLISHED", "report pending my post 状态异常");
    assert(
      reportPendingPost.viewerModeration &&
        reportPendingPost.viewerModeration.role === "AUTHOR" &&
        Number(reportPendingPost.viewerModeration.reportPendingCount || 0) === 2 &&
        reportPendingPost.viewerModeration.reportStatus === "PENDING",
      "report pending my post 未返回正确的投诉状态"
    );
    assertFieldAbsent(reportPendingPost.metadata, "reportLogs", "report pending my post metadata");
    assertFieldAbsent(reportPendingPost.metadata, "reportStatus", "report pending my post metadata");

    const hiddenResolvedPost = findItemById(items, AUTHOR_WORKBENCH_POST_IDS.hiddenResolved, "my posts");
    assert(hiddenResolvedPost.status === "HIDDEN", "hidden resolved my post 状态异常");
    assert(
      hiddenResolvedPost.viewerModeration &&
        hiddenResolvedPost.viewerModeration.reportStatus === "RESOLVED",
      "hidden resolved my post 未返回正确的投诉处理状态"
    );

    summary.myPostCount = items.length;
    summary.myPostAttentionCount = items.filter((item) => {
      const moderation = item && item.viewerModeration ? item.viewerModeration : null;
      return Boolean(
        item &&
          (item.status === "HIDDEN" ||
            (moderation &&
              (moderation.reviewStatus === "PENDING" ||
                moderation.reviewStatus === "REJECTED" ||
                Number(moderation.reportPendingCount || 0) > 0)))
      );
    }).length;
    summary.myPostHiddenCount = items.filter((item) => item && item.status === "HIDDEN").length;
    summary.ids.authorWorkbenchPlainPostId = AUTHOR_WORKBENCH_POST_IDS.plain;
    summary.ids.authorWorkbenchReportPendingPostId = AUTHOR_WORKBENCH_POST_IDS.reportPending;
    return payload;
  });

  const postId = postsPayload.data.items[0].id;

  await runStep("posts.detail", async () => {
    const response = await requestJson({
      pathname: "/api/posts/detail",
      query: {
        postId,
        incrementRead: 0,
      },
      headers: {
        "x-session-token": buyerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/posts/detail", 200);
    assert(payload.data && payload.data.id === postId, "post detail ID 不匹配");
    return payload;
  });

  await runStep("posts.detail.author-workbench.plain", async () => {
    const response = await requestJson({
      pathname: "/api/posts/detail",
      query: {
        postId: AUTHOR_WORKBENCH_POST_IDS.plain,
        incrementRead: 0,
      },
      headers: {
        "x-session-token": buyerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/posts/detail (author-workbench plain)", 200);
    assert(payload.data && payload.data.id === AUTHOR_WORKBENCH_POST_IDS.plain, "author-workbench plain detail ID 不匹配");
    assert(payload.data.viewerModeration === null, "author-workbench plain detail 不应返回 viewerModeration");
    assertFieldAbsent(payload.data.metadata, "reportLogs", "author-workbench plain detail metadata");
    assertFieldAbsent(payload.data.metadata, "reportStatus", "author-workbench plain detail metadata");
    return payload;
  });

  await runStep("posts.detail.author-workbench.author-moderated", async () => {
    const response = await requestJson({
      pathname: "/api/posts/detail",
      query: {
        postId: AUTHOR_WORKBENCH_POST_IDS.reportPending,
        incrementRead: 0,
      },
      headers: {
        "x-session-token": buyerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/posts/detail (author-workbench author moderated)", 200);
    assert(payload.data && payload.data.id === AUTHOR_WORKBENCH_POST_IDS.reportPending, "author moderated detail ID 不匹配");
    assert(
      payload.data.viewerModeration &&
        payload.data.viewerModeration.role === "AUTHOR" &&
        payload.data.viewerModeration.reportStatus === "PENDING" &&
        Number(payload.data.viewerModeration.reportPendingCount || 0) === 2,
      "author moderated detail 未返回正确的 author viewerModeration"
    );
    assertFieldAbsent(payload.data.metadata, "reportLogs", "author moderated detail metadata");
    assertFieldAbsent(payload.data.metadata, "reportStatus", "author moderated detail metadata");
    assertFieldAbsent(payload.data.viewerModeration, "reportLogs", "author moderated detail viewerModeration");
    assertFieldAbsent(payload.data.viewerModeration, "reporterName", "author moderated detail viewerModeration");
    assertFieldAbsent(payload.data.viewerModeration, "reporterUserId", "author moderated detail viewerModeration");
    return payload;
  });

  await runStep("posts.detail.author-workbench.manager-moderated", async () => {
    const response = await requestJson({
      pathname: "/api/posts/detail",
      query: {
        postId: AUTHOR_WORKBENCH_POST_IDS.reportPending,
        incrementRead: 0,
      },
      headers: {
        "x-session-token": ownerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/posts/detail (author-workbench manager moderated)", 200);
    assert(payload.data && payload.data.id === AUTHOR_WORKBENCH_POST_IDS.reportPending, "manager moderated detail ID 不匹配");
    assert(
      payload.data.viewerModeration &&
        payload.data.viewerModeration.role === "MANAGER" &&
        payload.data.viewerModeration.reportStatus === "PENDING" &&
        Number(payload.data.viewerModeration.reportPendingCount || 0) === 2,
      "manager moderated detail 未返回正确的 manager viewerModeration"
    );
    assertFieldAbsent(payload.data.metadata, "reportLogs", "manager moderated detail metadata");
    assertFieldAbsent(payload.data.metadata, "reportStatus", "manager moderated detail metadata");
    assertFieldAbsent(payload.data.viewerModeration, "reportLogs", "manager moderated detail viewerModeration");
    assertFieldAbsent(payload.data.viewerModeration, "reporterName", "manager moderated detail viewerModeration");
    assertFieldAbsent(payload.data.viewerModeration, "reporterUserId", "manager moderated detail viewerModeration");
    return payload;
  });

  await runStep("posts.comments", async () => {
    const response = await requestJson({
      pathname: "/api/posts/comments",
      query: {
        postId,
      },
      headers: {
        "x-session-token": buyerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/posts/comments", 200);
    const items = expectArray(payload.data, "post comments");
    summary.commentCount = items.length;
    return payload;
  });

  await runStep("planets.pinned-posts", async () => {
    const response = await requestJson({
      pathname: "/api/planets/pinned-posts",
      query: {
        groupId: GROUP_ID,
      },
      headers: {
        "x-session-token": buyerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/planets/pinned-posts", 200);
    const items = expectArray(payload.data, "pinned posts");
    assert(items.length > 0, "pinned posts 为空");
    const welcomePost = findItemById(items, "pst_welcome_001", "pinned posts");
    assert(welcomePost.isPinned === true, "pinned welcome post 状态异常");
    summary.pinnedPostCount = items.length;
    summary.ids.pinnedPostId = welcomePost.id;
    return payload;
  });

  const columnsPayload = await runStep("planets.columns", async () => {
    const response = await requestJson({
      pathname: "/api/planets/columns",
      query: {
        groupId: GROUP_ID,
        sessionToken: ownerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/planets/columns", 200);
    const items = expectArray(payload.data && payload.data.items, "columns");
    assert(items.length > 0, "columns 为空");
    summary.columnCount = items.length;
    summary.ids.columnId = items[0].id;
    return payload;
  });

  const columnId = columnsPayload.data.items[0].id;

  await runStep("planets.columns.detail", async () => {
    const response = await requestJson({
      pathname: "/api/planets/columns/detail",
      query: {
        columnId,
        groupId: GROUP_ID,
        sessionToken: ownerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/planets/columns/detail", 200);
    assert(payload.data && payload.data.columnId === columnId, "column detail ID 不匹配");
    return payload;
  });

  const challengesPayload = await runStep("checkin.challenges", async () => {
    const response = await requestJson({
      pathname: "/api/checkin/challenges",
      query: {
        groupId: GROUP_ID,
        status: "ONGOING",
        sessionToken: ownerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/checkin/challenges", 200);
    const items = expectArray(payload.data && payload.data.items, "checkin challenges");
    assert(items.length > 0, "checkin challenges 为空");
    summary.challengeCount = items.length;
    summary.ids.challengeId = items[0].id;
    return payload;
  });

  const challengeId = challengesPayload.data.items[0].id;

  await runStep("checkin.challenges.detail", async () => {
    const response = await requestJson({
      pathname: "/api/checkin/challenges/detail",
      query: {
        challengeId,
        sessionToken: ownerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/checkin/challenges/detail", 200);
    assert(payload.data && payload.data.id === challengeId, "challenge detail ID 不匹配");
    return payload;
  });

  await runStep("checkin.challenges.join", async () => {
    const response = await requestJson({
      method: "POST",
      pathname: "/api/checkin/challenges/join",
      body: {
        challengeId,
      },
      headers: {
        "x-session-token": ownerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/checkin/challenges/join", 200);
    assert(payload.data && payload.data.id === challengeId, "challenge join 返回挑战ID不匹配");
    assert(payload.data.isJoined === true, "challenge join 后 isJoined 不是 true");
    return payload;
  });

  await runStep("checkin.rankings", async () => {
    const response = await requestJson({
      pathname: "/api/checkin/rankings",
      query: {
        challengeId,
        sessionToken: ownerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/checkin/rankings", 200);
    expectArray(payload.data && payload.data.streakRanking, "checkin streak ranking");
    expectArray(payload.data && payload.data.totalRanking, "checkin total ranking");
    return payload;
  });

  await runStep("checkin.records", async () => {
    const dateParts = nowDateParts();
    const response = await requestJson({
      pathname: "/api/checkin/records",
      query: {
        challengeId,
        year: dateParts.year,
        month: dateParts.month,
        day: dateParts.day,
        sessionToken: ownerSessionToken,
      },
    });
    const payload = assertSuccess(response, "/api/checkin/records", 200);
    expectArray(payload.data && payload.data.calendarDays, "checkin calendarDays");
    expectArray(payload.data && payload.data.myPosts, "checkin myPosts");
    return payload;
  });

  await runStep("ai.ask", async () => {
    const response = await requestJson({
      method: "POST",
      pathname: "/api/ai/ask",
      body: {
        query: "怎么看美联储加息和A股？",
        history: [
          {
            role: "user",
            content: "我想先看金融货币这条线。",
          },
        ],
      },
    });
    const payload = assertSuccess(response, "/api/ai/ask", 200);
    assert(payload.data && typeof payload.data.answer === "string" && payload.data.answer.trim(), "AI answer 为空");
    assert(payload.data.mode === "llm" || payload.data.mode === "kb_fallback", `AI mode 异常: ${payload.data.mode}`);
    assert(typeof payload.data.modeLabel === "string" && payload.data.modeLabel.trim(), "AI modeLabel 为空");
    assert(typeof payload.data.coverageHint === "string" && payload.data.coverageHint.trim(), "AI coverageHint 为空");
    expectNonEmptyStringArray(payload.data.suggestions, "AI suggestions");
    assert(Array.isArray(payload.data.sources) && payload.data.sources.length > 0, "AI sources 为空");
    summary.aiMode = payload.data.mode;
    summary.aiSourceCount = payload.data.sources.length;
    summary.aiSuggestionCount = payload.data.suggestions.length;
    return payload;
  });

  await runStep("ai.ask.kb-empty", async () => {
    const response = await requestJson({
      method: "POST",
      pathname: "/api/ai/ask",
      body: {
        query: "知识产品",
      },
    });
    const payload = assertSuccess(response, "/api/ai/ask (kb-empty)", 200);
    assert(payload.data && payload.data.mode === "kb_empty", `AI kb-empty mode 异常: ${payload.data && payload.data.mode}`);
    assert(typeof payload.data.answer === "string" && payload.data.answer.trim(), "AI kb-empty answer 为空");
    assert(Array.isArray(payload.data.sources) && payload.data.sources.length === 0, "AI kb-empty sources 应为空");
    assert(typeof payload.data.modeLabel === "string" && payload.data.modeLabel.trim(), "AI kb-empty modeLabel 为空");
    assert(typeof payload.data.coverageHint === "string" && payload.data.coverageHint.includes("金融货币"), "AI kb-empty coverageHint 异常");
    expectNonEmptyStringArray(payload.data.suggestions, "AI kb-empty suggestions");
    summary.aiEmptyMode = payload.data.mode;
    summary.aiEmptySuggestionCount = payload.data.suggestions.length;
    return payload;
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        baseUrl: BASE_URL,
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
