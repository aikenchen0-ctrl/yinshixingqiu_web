const https = require("https");

const WECHAT_CODE_TO_SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session";
const WECHAT_ACCESS_TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
const WECHAT_PHONE_NUMBER_URL = "https://api.weixin.qq.com/wxa/business/getuserphonenumber";
const WECHAT_UNLIMITED_MINI_CODE_URL = "https://api.weixin.qq.com/wxa/getwxacodeunlimit";
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_REFRESH_INTERVAL_MS = 105 * 60 * 1000;

let accessTokenCache = {
  token: "",
  expiresAt: 0,
};
let accessTokenRefreshPromise = null;
let accessTokenRefreshTimer = null;

function getWechatConfig() {
  const appId = process.env.WECHAT_APP_ID || "";
  const appSecret = process.env.WECHAT_APP_SECRET || "";

  return {
    appId: appId.trim(),
    appSecret: appSecret.trim(),
  };
}

function ensureWechatConfig() {
  const { appId, appSecret } = getWechatConfig();

  if (!appId || !appSecret) {
    throw new Error("未配置微信小程序凭证，请先设置 WECHAT_APP_ID 和 WECHAT_APP_SECRET");
  }

  return { appId, appSecret };
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error(`微信接口请求失败，状态码 ${response.statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error("微信接口返回了无法解析的内容"));
          }
        });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const body = JSON.stringify(payload || {});

    const req = https.request(
      {
        hostname: requestUrl.hostname,
        path: `${requestUrl.pathname}${requestUrl.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        let responseBody = "";

        response.on("data", (chunk) => {
          responseBody += chunk;
        });

        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error(`微信接口请求失败，状态码 ${response.statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(responseBody));
          } catch (error) {
            reject(new Error("微信接口返回了无法解析的内容"));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function postBuffer(url, payload) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const body = JSON.stringify(payload || {});

    const req = https.request(
      {
        hostname: requestUrl.hostname,
        path: `${requestUrl.pathname}${requestUrl.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        const chunks = [];

        response.on("data", (chunk) => {
          chunks.push(chunk);
        });

        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error(`微信接口请求失败，状态码 ${response.statusCode}`));
            return;
          }

          resolve({
            buffer: Buffer.concat(chunks),
            contentType: String(response.headers["content-type"] || ""),
          });
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function normalizeMiniProgramEnvVersion(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (normalizedValue === "release" || normalizedValue === "trial" || normalizedValue === "develop") {
    return normalizedValue;
  }

  return "";
}

function getMiniProgramCodeEnvVersion() {
  const configuredEnvVersion = normalizeMiniProgramEnvVersion(
    process.env.WECHAT_MINI_CODE_ENV_VERSION || process.env.WECHAT_MINIPROGRAM_ENV_VERSION
  );

  if (configuredEnvVersion) {
    return configuredEnvVersion;
  }

  return process.env.NODE_ENV === "production" ? "release" : "develop";
}

function parseWechatJsonBuffer(buffer) {
  const text = buffer.toString("utf8").trim();
  if (!text || !/^\{/.test(text)) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

async function requestUnlimitedMiniProgramCode(accessToken, payload) {
  const response = await postBuffer(`${WECHAT_UNLIMITED_MINI_CODE_URL}?access_token=${accessToken}`, payload);
  const parsedError = parseWechatJsonBuffer(response.buffer);

  if (parsedError && parsedError.errcode) {
    return {
      ok: false,
      retryableTokenError: parsedError.errcode === 40001 || parsedError.errcode === 42001,
      error: parsedError,
    };
  }

  if (!response.buffer.length) {
    return {
      ok: false,
      retryableTokenError: false,
      error: {
        errmsg: "微信小程序码返回为空",
      },
    };
  }

  return {
    ok: true,
    buffer: response.buffer,
    contentType: response.contentType,
  };
}

async function exchangeLoginCode(loginCode) {
  if (!loginCode) {
    throw new Error("缺少微信登录 code");
  }

  const { appId, appSecret } = ensureWechatConfig();
  const searchParams = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    js_code: loginCode,
    grant_type: "authorization_code",
  });
  const result = await requestJson(`${WECHAT_CODE_TO_SESSION_URL}?${searchParams.toString()}`);

  if (result.errcode) {
    throw new Error(result.errmsg || `微信登录失败，错误码 ${result.errcode}`);
  }

  if (!result.openid || !result.session_key) {
    throw new Error("微信登录返回缺少 openid 或 session_key");
  }

  return {
    openId: result.openid,
    unionId: result.unionid || null,
    sessionKey: result.session_key,
  };
}

function shouldReuseAccessToken() {
  return Boolean(accessTokenCache.token) && accessTokenCache.expiresAt > Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS;
}

async function refreshAccessToken() {
  const { appId, appSecret } = ensureWechatConfig();
  const searchParams = new URLSearchParams({
    grant_type: "client_credential",
    appid: appId,
    secret: appSecret,
  });
  const result = await requestJson(`${WECHAT_ACCESS_TOKEN_URL}?${searchParams.toString()}`);

  if (result.errcode) {
    throw new Error(result.errmsg || `获取微信 access_token 失败，错误码 ${result.errcode}`);
  }

  if (!result.access_token) {
    throw new Error("微信 access_token 返回为空");
  }

  accessTokenCache = {
    token: result.access_token,
    expiresAt: Date.now() + Number(result.expires_in || 7200) * 1000,
  };

  return accessTokenCache.token;
}

async function getAccessToken(forceRefresh = false) {
  if (!forceRefresh && shouldReuseAccessToken()) {
    return accessTokenCache.token;
  }

  if (!accessTokenRefreshPromise) {
    accessTokenRefreshPromise = refreshAccessToken().finally(() => {
      accessTokenRefreshPromise = null;
    });
  }

  return accessTokenRefreshPromise;
}

async function fetchPhoneNumber(phoneCode) {
  if (!phoneCode) {
    throw new Error("缺少手机号授权 code");
  }

  let accessToken = await getAccessToken();
  let result = await postJson(`${WECHAT_PHONE_NUMBER_URL}?access_token=${accessToken}`, {
    code: phoneCode,
  });

  if (result.errcode === 40001 || result.errcode === 42001) {
    accessToken = await getAccessToken(true);
    result = await postJson(`${WECHAT_PHONE_NUMBER_URL}?access_token=${accessToken}`, {
      code: phoneCode,
    });
  }

  if (result.errcode) {
    throw new Error(result.errmsg || `获取手机号失败，错误码 ${result.errcode}`);
  }

  const phoneInfo = result.phone_info || {};
  const phoneNumber = phoneInfo.purePhoneNumber || phoneInfo.phoneNumber || "";

  if (!phoneNumber) {
    throw new Error("微信未返回手机号");
  }

  return {
    phoneNumber,
    countryCode: phoneInfo.countryCode || "",
  };
}

async function generateUnlimitedMiniProgramCode(options = {}) {
  const page = String(options.page || "").trim();
  const scene = String(options.scene || "").trim();
  const envVersion = normalizeMiniProgramEnvVersion(options.envVersion) || getMiniProgramCodeEnvVersion();
  const width = Number.isFinite(Number(options.width)) ? Math.max(Math.floor(Number(options.width)), 280) : 430;

  if (!page) {
    throw new Error("缺少小程序码页面路径");
  }

  if (!scene) {
    throw new Error("缺少小程序码 scene 参数");
  }

  if (scene.length > 32) {
    throw new Error("小程序码 scene 参数不能超过 32 个字符");
  }

  const payload = {
    page,
    scene,
    check_path: false,
    env_version: envVersion,
    width,
  };

  let accessToken = await getAccessToken();
  let result = await requestUnlimitedMiniProgramCode(accessToken, payload);

  if (!result.ok && result.retryableTokenError) {
    accessToken = await getAccessToken(true);
    result = await requestUnlimitedMiniProgramCode(accessToken, payload);
  }

  if (!result.ok) {
    const errorMessage = result.error && result.error.errmsg ? result.error.errmsg : "生成微信小程序码失败";
    const errorCode = result.error && result.error.errcode ? `，错误码 ${result.error.errcode}` : "";
    throw new Error(`${errorMessage}${errorCode}`);
  }

  return {
    buffer: result.buffer,
    contentType: result.contentType,
    envVersion,
  };
}

function startAccessTokenRefreshScheduler() {
  if (accessTokenRefreshTimer) {
    return;
  }

  accessTokenRefreshTimer = setInterval(() => {
    getAccessToken(true).catch((error) => {
      console.error("[wechatService] access_token refresh failed", error.message || error);
    });
  }, ACCESS_TOKEN_REFRESH_INTERVAL_MS);

  if (typeof accessTokenRefreshTimer.unref === "function") {
    accessTokenRefreshTimer.unref();
  }

  getAccessToken().catch((error) => {
    console.error("[wechatService] initial access_token preload failed", error.message || error);
  });
}

module.exports = {
  exchangeLoginCode,
  fetchPhoneNumber,
  generateUnlimitedMiniProgramCode,
  getAccessToken,
  getMiniProgramCodeEnvVersion,
  startAccessTokenRefreshScheduler,
};
