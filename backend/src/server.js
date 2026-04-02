const http = require("http");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ quiet: true });
const {
  buildPreview,
  createJoinOrder,
  applyPaymentSuccess,
  getMembershipStatus,
  getOrder,
  getDebugState,
} = require("./services/joinFlowService");
const { startAccessTokenRefreshScheduler } = require("./services/wechatService");
const {
  loginOrRegister,
  loginOrRegisterByPhone,
  getSessionProfile,
  logoutSession,
} = require("./services/authService");
const {
  createPlanet,
  getDiscoverPlanets,
  getJoinedPlanets,
  getMyPlanets,
} = require("./services/planetService");
const {
  getGroupHome,
  listPostsByTab,
  listPinnedPosts,
  listDiscoverFeaturedPosts,
  getPostDetail,
  createPost,
  updatePost,
  listComments,
  listMyPosts,
  createComment,
  togglePostLike,
  toggleCommentLike,
} = require("./services/contentService");
const { sendJson, readJsonBody } = require("./utils/http");
const { prisma } = require("./db/prisma");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
const uploadRootPath = path.join(__dirname, "..", "uploads");
const promotionDataPayload = {
  title: "ysc的星球",
  subtitle: "",
  tag: "数据概览",
  breadcrumb: "‹ 返回星球列表",
  summaryRows: [
    [
      { label: "累积收入(元)", value: "1280.00", hint: "昨日收入 168.00" },
      { label: "本周收入(元)", value: "368.00", hint: "上周收入 420.00" },
      { label: "本月收入(元)", value: "1280.00", hint: "上月收入 0.00" }
    ],
    [
      { label: "付费加入收入(元)", value: "980.00", hint: "昨日收入 168.00" },
      { label: "续期收入(元)", value: "200.00", hint: "昨日收入 0.00" },
      { label: "赞赏收入(元)", value: "60.00", hint: "昨日收入 12.00" },
      { label: "付费提问收入(元)", value: "40.00", hint: "昨日收入 0.00" }
    ]
  ],
  memberRows: [
    { label: "总成员数", value: "42", hint: "昨日加入成员 3" },
    { label: "付费加入成员", value: "28", hint: "昨日加入成员 2" },
    { label: "本月续期成员", value: "6", hint: "上月续期成员 0" },
    { label: "昨日续期成员", value: "1", hint: "" }
  ],
  promotionFlow: [
    { count: "316", title: "访问星球预览页的人数（星球外用户）", action: "访问星球预览页", tone: "teal" },
    { count: "52", title: "点击「加入星球」按钮人数", action: "点击加入按钮", tone: "blue" },
    { count: "14", title: "成功加入星球的人数", action: "成功支付", tone: "orange" }
  ],
  renewalFlow: [
    { count: "12", title: "进入续期页面的人数", action: "进入续期页面", tone: "teal" },
    { count: "6", title: "支付成功的人数", action: "成功支付", tone: "orange" }
  ],
  adviceSections: [
    {
      title: "流量转化率: 16.46%",
      suffix: "（正常范围：35%~60%），你的转化率偏低，建议先优化导流页和渠道质量：",
      rows: [
        ["渠道追踪", "优先验证公众号菜单、朋友圈海报、视频号简介这三个入口，先找到最能带来点击的渠道。"],
        ["付费页优化", "补齐星球价值说明、适合人群、往期精华内容，先让用户快速看懂为什么要付费。"],
        ["内容创作", "连续更新 7 天，把最近最能代表价值的内容顶出来，帮助新访客建立信任。"]
      ]
    },
    {
      title: "支付成功率: 26.92%",
      suffix: "（正常范围：10%~30%），当前支付成功率可接受，建议继续保持：",
      rows: [
        ["优惠价格", "可以继续测试限时券和新用户券，观察不同价格带对成交的影响。"],
        ["价格展示优化", "把年费拆成每天成本展示，降低用户的心理门槛。"],
        ["官方学习指南", "把优秀案例的表达方式吸收过来，复用在自己的付费页文案里。"]
      ]
    },
    {
      title: "新成员月留存率: 71.43%",
      suffix: "（同规模星球平均：70%），留存已达平均线，可继续加强新成员激活：",
      rows: [
        ["精选内容", "新用户加入后优先看到精华内容和入门帖，能更快感受到价值。"],
        ["自动通知", "把入群欢迎语做成固定流程，引导成员完成第一次互动。"],
        ["成员登记信息", "在活跃期收集成员背景信息，便于后续做更精细的运营。"]
      ]
    }
  ]
};

function ensureUploadDir() {
  if (!fs.existsSync(uploadRootPath)) {
    fs.mkdirSync(uploadRootPath, { recursive: true });
  }
}

function sendFile(res, filePath) {
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
  };

  res.writeHead(200, {
    "Content-Type": mimeTypeMap[extension] || "application/octet-stream",
    "Cache-Control": "public, max-age=31536000",
    "Access-Control-Allow-Origin": "*",
  });

  fs.createReadStream(filePath).pipe(res);
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
  const extension = path.extname(originalName || "").toLowerCase() || ".jpg";
  const safeExtension = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"].includes(extension)
    ? extension
    : ".jpg";
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${stamp}_${random}${safeExtension}`;
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

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);
  console.log(`[request] ${req.method} ${requestUrl.pathname}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,x-session-token",
    });
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && requestUrl.pathname.startsWith("/uploads/")) {
      const relativePath = requestUrl.pathname.replace(/^\/uploads\//, "");
      const normalizedPath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
      const filePath = path.join(uploadRootPath, normalizedPath);
      sendFile(res, filePath);
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

    if (req.method === "POST" && requestUrl.pathname === "/api/planets/create") {
      const body = await readJsonBody(req);
      const sessionToken = req.headers["x-session-token"];
      const result = await createPlanet(sessionToken, body);
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

    if (req.method === "GET" && requestUrl.pathname === "/api/planets/my-posts") {
      const result = await listMyPosts(requestUrl.searchParams.get("sessionToken"));
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

      const todayFolder = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const targetDir = path.join(uploadRootPath, todayFolder);
      fs.mkdirSync(targetDir, { recursive: true });

      const savedName = createUploadFileName(file.filename);
      const savedPath = path.join(targetDir, savedName);
      fs.writeFileSync(savedPath, file.buffer);

      const publicUrl = `http://${req.headers.host}/uploads/${todayFolder}/${savedName}`;
      sendJson(res, 201, {
        ok: true,
        data: {
          url: publicUrl,
          filename: savedName,
        },
      });
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/orders/join") {
      const body = await readJsonBody(req);
      const result = await createJoinOrder(body);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/payments/mock-callback") {
      const body = await readJsonBody(req);
      const result = await applyPaymentSuccess(body);
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

    if (req.method === "GET" && requestUrl.pathname === "/api/auth/session") {
      const result = await getSessionProfile(requestUrl.searchParams.get("sessionToken"));
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
      const result = await getOrder(requestUrl.searchParams.get("orderNo"));
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/debug/state") {
      const result = await getDebugState();
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

    if (req.method === "GET" && requestUrl.pathname === "/api/admin/promotion/data") {
      sendJson(res, 200, promotionDataPayload);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/") {
      sendJson(res, 200, {
        ok: true,
        service: "xueyin-backend",
        endpoints: [
          "/health",
          "/schema",
          "/api/admin/promotion/data",
          "/api/auth/login",
          "/api/auth/session?sessionToken=<token>",
          "/api/auth/logout",
          "/api/planets/joined?sessionToken=<token>",
          "/api/planets/discover?sessionToken=<token>&limit=12",
          "/api/planets/home?groupId=<groupId>&sessionToken=<token>",
          "/api/planets/posts?groupId=<groupId>&tab=latest&limit=20",
          "/api/planets/pinned-posts?groupId=<groupId>",
          "/api/planets/posts",
          "/api/planets/my-posts?sessionToken=<token>",
          "/api/posts/detail?postId=<postId>",
          "/api/posts/comments?postId=<postId>",
          "/api/posts/comments",
          "/api/posts/like",
          "/api/comments/like",
          "/api/planets/preview?groupId=grp_datawhale_001&userId=usr_buyer_001&couponCode=NEW1000&channelCode=CH_WECHAT_MENU_001",
          "/api/orders/join",
          "/api/payments/mock-callback",
          "/api/orders/detail?orderNo=<orderNo>",
          "/api/memberships/status?groupId=grp_datawhale_001&userId=usr_buyer_001",
          "/api/debug/state",
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
    sendJson(res, 500, {
      ok: false,
      message: error.message || "Internal Server Error",
    });
  }
});

async function start() {
  ensureUploadDir();
  startAccessTokenRefreshScheduler();
  server.listen(PORT, HOST, () => {
    console.log(`xueyin-backend listening on http://${HOST}:${PORT}`);
  });
}

start().catch(async (error) => {
  console.error("failed to start xueyin-backend", error);
  await prisma.$disconnect();
  process.exit(1);
});
