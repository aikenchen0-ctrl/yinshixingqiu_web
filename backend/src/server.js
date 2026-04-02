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
const { sendJson, readJsonBody } = require("./utils/http");
const { prisma } = require("./db/prisma");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
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
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  try {
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
