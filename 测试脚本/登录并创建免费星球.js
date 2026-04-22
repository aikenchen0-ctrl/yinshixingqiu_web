const http = require("http");
const https = require("https");

const BASE_URL = String(process.env.FREE_PLANET_BASE_URL || "http://127.0.0.1:3000")
  .trim()
  .replace(/\/+$/, "");
const MOBILE = String(process.env.FREE_PLANET_MOBILE || "18750086213").trim();
const JOIN_TYPE = "rolling";
const PLANET_NAME = String(process.env.FREE_PLANET_NAME || "").trim() || buildDefaultPlanetName();
const REQUEST_TIMEOUT_MS = Number(process.env.FREE_PLANET_TIMEOUT_MS || 15000);

function buildDefaultPlanetName() {
  const now = new Date();
  const mm = `${now.getMonth() + 1}`.padStart(2, "0");
  const dd = `${now.getDate()}`.padStart(2, "0");
  const hh = `${now.getHours()}`.padStart(2, "0");
  const mi = `${now.getMinutes()}`.padStart(2, "0");
  const ss = `${now.getSeconds()}`.padStart(2, "0");
  return `免费星球${mm}${dd}${hh}${mi}${ss}`.slice(0, 15);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requestJson(input) {
  const requestUrl = new URL(`${BASE_URL}${input.pathname}`);
  const requestLib = requestUrl.protocol === "https:" ? https : http;
  const method = String(input.method || "GET").toUpperCase();
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
            reject(new Error(`接口返回了无法解析的 JSON: ${rawBody.slice(0, 300)}`));
            return;
          }

          resolve({
            statusCode: res.statusCode || 0,
            payload,
          });
        });
      }
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`请求超时 (${REQUEST_TIMEOUT_MS}ms): ${method} ${requestUrl.pathname}`));
    });

    req.on("error", reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

function assertSuccess(response, context, expectedStatusCode = 200) {
  assert(response.statusCode === expectedStatusCode, `${context} 状态码异常: ${response.statusCode}`);
  assert(response.payload && response.payload.ok === true, `${context} 返回 ok=false`);
  return response.payload;
}

async function checkHealth() {
  const response = await requestJson({
    pathname: "/health",
  });
  return assertSuccess(response, "/health");
}

async function loginByMobile() {
  const response = await requestJson({
    method: "POST",
    pathname: "/api/auth/web-mobile-login",
    body: {
      mobile: MOBILE,
    },
  });
  const payload = assertSuccess(response, "/api/auth/web-mobile-login");
  assert(payload.data && payload.data.sessionToken, "登录后未返回 sessionToken");
  return payload.data;
}

async function fetchSessionProfile(sessionToken) {
  const response = await requestJson({
    pathname: `/api/auth/session?sessionToken=${encodeURIComponent(sessionToken)}`,
  });
  const payload = assertSuccess(response, "/api/auth/session");
  assert(payload.data && payload.data.mobile === MOBILE, "session profile 中的手机号不匹配");
  return payload.data;
}

async function createFreePlanet(sessionToken) {
  const response = await requestJson({
    method: "POST",
    pathname: "/api/planets/create",
    headers: {
      "x-session-token": sessionToken,
    },
    body: {
      name: PLANET_NAME,
      price: 0,
      joinType: JOIN_TYPE,
    },
  });
  const payload = assertSuccess(response, "/api/planets/create");
  assert(payload.data && payload.data.id, "创建免费星球后未返回 groupId");
  assert(payload.data.isFree === true, "创建结果不是免费星球");
  assert(payload.data.price === 0, "创建结果 price 不是 0");
  return payload.data;
}

async function fetchMyPlanets(sessionToken, groupId) {
  const response = await requestJson({
    pathname: `/api/planets/mine?sessionToken=${encodeURIComponent(sessionToken)}`,
  });
  const payload = assertSuccess(response, "/api/planets/mine");
  const items = Array.isArray(payload.data) ? payload.data : [];
  const target = items.find((item) => item && item.id === groupId) || null;
  assert(target, `我的星球列表里没有找到刚创建的星球: ${groupId}`);
  return {
    items,
    target,
  };
}

async function main() {
  console.log(`[start] baseUrl=${BASE_URL}`);
  console.log(`[start] mobile=${MOBILE}`);
  console.log(`[start] planetName=${PLANET_NAME}`);

  await checkHealth();
  console.log("[pass] health");

  const loginResult = await loginByMobile();
  console.log(`[pass] login userId=${loginResult.id}`);

  const sessionProfile = await fetchSessionProfile(loginResult.sessionToken);
  console.log(`[pass] session nickname=${sessionProfile.nickname || "未命名用户"}`);

  const planet = await createFreePlanet(loginResult.sessionToken);
  console.log(`[pass] create groupId=${planet.id}`);

  const mine = await fetchMyPlanets(loginResult.sessionToken, planet.id);
  console.log(`[pass] mine planets count=${mine.items.length}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: BASE_URL,
        mobile: MOBILE,
        userId: loginResult.id,
        nickname: sessionProfile.nickname || "",
        sessionTokenPreview: `${String(loginResult.sessionToken).slice(0, 8)}...`,
        createdPlanet: {
          id: planet.id,
          name: planet.name,
          ownerName: planet.ownerName,
          price: planet.price,
          priceLabel: planet.priceLabel,
          isFree: planet.isFree,
          joinType: planet.joinType,
          joined: planet.joined,
          createdAt: planet.createdAt,
        },
        miniprogramHomePath: `/pages/planet/home?id=${encodeURIComponent(planet.id)}&name=${encodeURIComponent(
          planet.name
        )}&creator=${encodeURIComponent(planet.ownerName || "")}`,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        baseUrl: BASE_URL,
        mobile: MOBILE,
        planetName: PLANET_NAME,
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
