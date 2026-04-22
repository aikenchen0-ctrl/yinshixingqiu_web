const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const path = require("path");

const WECHAT_PAY_API_HOST = "api.mch.weixin.qq.com";
const WECHAT_PAY_API_BASE_URL = `https://${WECHAT_PAY_API_HOST}`;
const CALLBACK_TOLERANCE_MS = 5 * 60 * 1000;
const CERT_REFRESH_BUFFER_MS = 10 * 60 * 1000;
const MERCHANT_PRIVATE_KEY_FALLBACK_PATHS = [
  path.join("cert", "apiclient_key.pem"),
  path.join("certs", "apiclient_key.pem"),
  path.join("wxpay", "apiclient_key.pem"),
  path.join("wxpay", "cert", "apiclient_key.pem"),
];

let merchantPrivateKeyCache = {
  cacheKey: "",
  privateKey: "",
};

let platformCertificateCache = {
  certificates: [],
  refreshedAt: 0,
  expiresAt: 0,
};

function createWechatPayError(message, statusCode = 400, code = "WECHAT_PAY_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeEnvValue(value) {
  return String(value || "").trim();
}

function normalizeWechatPayMode(value, hasPartnerFields = false) {
  const normalized = normalizeEnvValue(value).toLowerCase();

  if (
    normalized === "partner" ||
    normalized === "service_provider" ||
    normalized === "service-provider" ||
    normalized === "serviceprovider" ||
    normalized === "sp"
  ) {
    return "partner";
  }

  if (normalized === "direct" || normalized === "merchant" || normalized === "normal") {
    return "direct";
  }

  return hasPartnerFields ? "partner" : "direct";
}

function getWechatPayConfig() {
  const directAppId = normalizeEnvValue(process.env.WECHAT_PAY_APP_ID || process.env.WECHAT_APP_ID);
  const directMchId = normalizeEnvValue(process.env.WECHAT_PAY_MCH_ID || process.env.WECHAT_PAY_MERCHANT_ID);
  const spAppId = normalizeEnvValue(process.env.WECHAT_PAY_SP_APP_ID || process.env.WECHAT_PAY_SERVICE_APP_ID);
  const spMchId = normalizeEnvValue(process.env.WECHAT_PAY_SP_MCH_ID || process.env.WECHAT_PAY_SERVICE_MCH_ID);
  const subAppId = normalizeEnvValue(process.env.WECHAT_PAY_SUB_APP_ID);
  const subMchId = normalizeEnvValue(process.env.WECHAT_PAY_SUB_MCH_ID);
  const mode = normalizeWechatPayMode(process.env.WECHAT_PAY_MODE, Boolean(spAppId || spMchId || subAppId || subMchId));
  const paySignAppId = mode === "partner" ? subAppId || spAppId : directAppId;
  const authMchId = mode === "partner" ? spMchId : directMchId;

  return {
    mode,
    appId: paySignAppId,
    mchId: authMchId,
    directAppId,
    directMchId,
    spAppId: mode === "partner" ? spAppId : "",
    spMchId: mode === "partner" ? spMchId : "",
    subAppId: mode === "partner" ? subAppId : "",
    subMchId: mode === "partner" ? subMchId : "",
    paySignAppId,
    apiV3Key: normalizeEnvValue(process.env.WECHAT_PAY_API_V3_KEY || process.env.WECHAT_PAY_APIV3_KEY),
    merchantSerialNo: normalizeEnvValue(
      process.env.WECHAT_PAY_MERCHANT_SERIAL_NO || process.env.WECHAT_PAY_MERCHANT_SERIAL_NUMBER
    ),
    privateKey: String(process.env.WECHAT_PAY_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim(),
    privateKeyPath: normalizeEnvValue(process.env.WECHAT_PAY_PRIVATE_KEY_PATH),
    privateKeyWindowsPath: normalizeEnvValue(process.env.WECHAT_PAY_PRIVATE_KEY_WINDOWS_PATH),
    notifyUrl: normalizeEnvValue(process.env.WECHAT_PAY_NOTIFY_URL || process.env.WECHAT_PAY_NOTIFYURL),
  };
}

function ensureWechatPayConfig() {
  const config = getWechatPayConfig();
  const missingFields = [];

  if (config.mode === "partner") {
    if (!config.paySignAppId) {
      missingFields.push("WECHAT_PAY_SUB_APP_ID");
    }

    if (!config.spMchId) {
      missingFields.push("WECHAT_PAY_SP_MCH_ID");
    }

    if (!config.subMchId) {
      missingFields.push("WECHAT_PAY_SUB_MCH_ID");
    }
  } else {
    if (!config.appId) {
      missingFields.push("WECHAT_PAY_APP_ID");
    }

    if (!config.mchId) {
      missingFields.push("WECHAT_PAY_MCH_ID");
    }
  }

  if (!config.apiV3Key) {
    missingFields.push("WECHAT_PAY_API_V3_KEY");
  }

  if (!config.merchantSerialNo) {
    missingFields.push("WECHAT_PAY_MERCHANT_SERIAL_NO");
  }

  if (!config.privateKey && !config.privateKeyPath && !config.privateKeyWindowsPath) {
    missingFields.push("WECHAT_PAY_PRIVATE_KEY_PATH");
  }

  if (!config.notifyUrl) {
    missingFields.push("WECHAT_PAY_NOTIFY_URL");
  }

  if (missingFields.length) {
    throw createWechatPayError(`微信支付配置缺失：${missingFields.join("、")}`, 500, "WECHAT_PAY_CONFIG_MISSING");
  }

  if (Buffer.byteLength(config.apiV3Key, "utf8") !== 32) {
    throw createWechatPayError("WECHAT_PAY_API_V3_KEY 长度必须为 32 字节", 500, "WECHAT_PAY_CONFIG_INVALID");
  }

  return config;
}

function resolveReadableFilePath(inputPath) {
  const normalizedPath = normalizeEnvValue(inputPath);
  if (!normalizedPath) {
    return "";
  }

  if (fs.existsSync(normalizedPath)) {
    return normalizedPath;
  }

  if (path.isAbsolute(normalizedPath)) {
    return "";
  }

  const resolvedPath = path.resolve(path.join(__dirname, "..", ".."), normalizedPath);
  return fs.existsSync(resolvedPath) ? resolvedPath : "";
}

function listReadableMerchantPrivateKeyPaths(config = getWechatPayConfig()) {
  const fallbackPaths = MERCHANT_PRIVATE_KEY_FALLBACK_PATHS.map((item) =>
    path.resolve(path.join(__dirname, "..", ".."), item)
  );

  return [config.privateKeyPath, config.privateKeyWindowsPath, ...fallbackPaths]
    .map(resolveReadableFilePath)
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);
}

function loadMerchantPrivateKey(config = ensureWechatPayConfig()) {
  const inlineKey = config.privateKey;
  if (inlineKey) {
    const cacheKey = `inline:${inlineKey}`;
    if (merchantPrivateKeyCache.cacheKey === cacheKey && merchantPrivateKeyCache.privateKey) {
      return merchantPrivateKeyCache.privateKey;
    }

    merchantPrivateKeyCache = {
      cacheKey,
      privateKey: inlineKey,
    };
    return inlineKey;
  }

  const candidatePaths = listReadableMerchantPrivateKeyPaths(config);

  if (!candidatePaths.length) {
    throw createWechatPayError(
      "未找到微信支付商户私钥文件，请检查 WECHAT_PAY_PRIVATE_KEY_PATH 或 WECHAT_PAY_PRIVATE_KEY_WINDOWS_PATH",
      500,
      "WECHAT_PAY_PRIVATE_KEY_MISSING"
    );
  }

  const resolvedPath = candidatePaths[0];
  const cacheKey = `file:${resolvedPath}`;
  if (merchantPrivateKeyCache.cacheKey === cacheKey && merchantPrivateKeyCache.privateKey) {
    return merchantPrivateKeyCache.privateKey;
  }

  try {
    const privateKey = fs.readFileSync(resolvedPath, "utf8").trim();
    if (!privateKey) {
      throw new Error("empty private key");
    }

    merchantPrivateKeyCache = {
      cacheKey,
      privateKey,
    };
    return privateKey;
  } catch (error) {
    throw createWechatPayError(
      `读取微信支付商户私钥失败：${error && error.message ? error.message : "未知错误"}`,
      500,
      "WECHAT_PAY_PRIVATE_KEY_READ_FAILED"
    );
  }
}

function inspectWechatPayReadiness() {
  try {
    const config = ensureWechatPayConfig();
    const diagnostics = {
      ready: true,
      mode: config.mode,
      appId: config.appId,
      mchId: config.mchId,
      spAppId: config.spAppId,
      spMchId: config.spMchId,
      subAppId: config.subAppId,
      subMchId: config.subMchId,
      notifyUrl: config.notifyUrl,
      privateKeyMode: config.privateKey ? "inline" : "file",
      privateKeyPath: "",
      message: "ok",
    };

    if (config.privateKey) {
      loadMerchantPrivateKey(config);
      return diagnostics;
    }

    const candidatePaths = listReadableMerchantPrivateKeyPaths(config);
    diagnostics.privateKeyPath = candidatePaths[0] || "";
    loadMerchantPrivateKey(config);
    return diagnostics;
  } catch (error) {
    const config = getWechatPayConfig();
    return {
      ready: false,
      mode: config.mode,
      appId: config.appId,
      mchId: config.mchId,
      spAppId: config.spAppId,
      spMchId: config.spMchId,
      subAppId: config.subAppId,
      subMchId: config.subMchId,
      notifyUrl: config.notifyUrl,
      privateKeyMode: String(process.env.WECHAT_PAY_PRIVATE_KEY || "").trim() ? "inline" : "file",
      privateKeyPath: listReadableMerchantPrivateKeyPaths(config)[0] || "",
      message: error && error.message ? error.message : "微信支付配置不可用",
      code: error && error.code ? error.code : "",
    };
  }
}

function buildRequestSignatureMessage(method, pathnameWithQuery, timestamp, nonceStr, bodyText) {
  return `${method}\n${pathnameWithQuery}\n${timestamp}\n${nonceStr}\n${bodyText}\n`;
}

function signMessage(privateKey, message) {
  return crypto.sign("RSA-SHA256", Buffer.from(message, "utf8"), privateKey).toString("base64");
}

function verifyMessageSignature(publicKey, message, signature) {
  return crypto.verify("RSA-SHA256", Buffer.from(message, "utf8"), publicKey, Buffer.from(signature, "base64"));
}

function buildAuthorizationHeader(config, method, pathnameWithQuery, bodyText) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = crypto.randomBytes(16).toString("hex");
  const privateKey = loadMerchantPrivateKey(config);
  const message = buildRequestSignatureMessage(method, pathnameWithQuery, timestamp, nonceStr, bodyText);
  const signature = signMessage(privateKey, message);

  return {
    timestamp,
    nonceStr,
    authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${config.merchantSerialNo}",signature="${signature}"`,
  };
}

function decryptAes256GcmText(input, apiV3Key) {
  if (!input || input.algorithm !== "AEAD_AES_256_GCM") {
    throw createWechatPayError("微信支付返回了不支持的加密算法", 500, "WECHAT_PAY_UNSUPPORTED_ALGORITHM");
  }

  const ciphertext = Buffer.from(String(input.ciphertext || ""), "base64");
  if (ciphertext.length <= 16) {
    throw createWechatPayError("微信支付加密报文无效", 500, "WECHAT_PAY_INVALID_CIPHERTEXT");
  }

  const key = Buffer.from(apiV3Key, "utf8");
  const nonce = Buffer.from(String(input.nonce || ""), "utf8");
  const associatedData = Buffer.from(String(input.associated_data || ""), "utf8");
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);

  if (associatedData.length) {
    decipher.setAAD(associatedData);
  }

  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function decryptAes256GcmJson(input, apiV3Key) {
  const decryptedText = decryptAes256GcmText(input, apiV3Key);

  try {
    return JSON.parse(decryptedText);
  } catch (error) {
    throw createWechatPayError("微信支付解密后的资源不是有效 JSON", 400, "WECHAT_PAY_DECRYPT_JSON_INVALID");
  }
}

function createWechatPayRequest(pathname, payload) {
  const config = ensureWechatPayConfig();
  const requestBody = payload ? JSON.stringify(payload) : "";
  const { authorization } = buildAuthorizationHeader(config, "POST", pathname, requestBody);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: WECHAT_PAY_API_HOST,
        path: pathname,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
          Authorization: authorization,
          "User-Agent": "xueyin-miniapp/1.0",
        },
      },
      (response) => {
        const chunks = [];

        response.on("data", (chunk) => {
          chunks.push(chunk);
        });

        response.on("end", () => {
          const responseText = Buffer.concat(chunks).toString("utf8");
          let parsedResponse = null;

          if (responseText.trim()) {
            try {
              parsedResponse = JSON.parse(responseText);
            } catch (error) {
              parsedResponse = null;
            }
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve({
              statusCode: response.statusCode,
              headers: response.headers,
              data: parsedResponse,
              text: responseText,
            });
            return;
          }

          const errorMessage =
            (parsedResponse && (parsedResponse.message || parsedResponse.code || parsedResponse.detail)) ||
            responseText ||
            `HTTP ${response.statusCode}`;

          reject(
            createWechatPayError(`微信支付请求失败：${errorMessage}`, response.statusCode >= 500 ? 502 : 400, "WECHAT_PAY_REQUEST_FAILED")
          );
        });
      }
    );

    request.on("error", (error) => {
      reject(createWechatPayError(`微信支付网络请求失败：${error.message || error}`, 502, "WECHAT_PAY_NETWORK_ERROR"));
    });

    request.write(requestBody);
    request.end();
  });
}

function createWechatPayGetRequest(pathname, options = {}) {
  const config = ensureWechatPayConfig();
  const { authorization } = buildAuthorizationHeader(config, "GET", pathname, "");
  const failureMessage = String(options.failureMessage || "微信支付读取请求失败");
  const failureCode = String(options.failureCode || "WECHAT_PAY_READ_FAILED");
  const failureStatusCode =
    typeof options.failureStatusCode === "number" && options.failureStatusCode > 0 ? options.failureStatusCode : null;

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: WECHAT_PAY_API_HOST,
        path: pathname,
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: authorization,
          "User-Agent": "xueyin-miniapp/1.0",
        },
      },
      (response) => {
        const chunks = [];

        response.on("data", (chunk) => {
          chunks.push(chunk);
        });

        response.on("end", () => {
          const responseText = Buffer.concat(chunks).toString("utf8");
          let parsedResponse = null;

          if (responseText.trim()) {
            try {
              parsedResponse = JSON.parse(responseText);
            } catch (error) {
              parsedResponse = null;
            }
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve({
              statusCode: response.statusCode,
              headers: response.headers,
              data: parsedResponse,
              text: responseText,
            });
            return;
          }

          const errorMessage =
            (parsedResponse && (parsedResponse.message || parsedResponse.code || parsedResponse.detail)) ||
            responseText ||
            `HTTP ${response.statusCode}`;

          reject(
            createWechatPayError(
              `${failureMessage}：${errorMessage}`,
              failureStatusCode || (response.statusCode >= 500 ? 502 : 400),
              failureCode
            )
          );
        });
      }
    );

    request.on("error", (error) => {
      reject(createWechatPayError(`${failureMessage}：${error.message || error}`, 502, failureCode));
    });

    request.end();
  });
}

function getPlatformCertificatePublicKey(certificatePem) {
  try {
    const certificate = new crypto.X509Certificate(certificatePem);
    return certificate.publicKey;
  } catch (error) {
    return crypto.createPublicKey(certificatePem);
  }
}

async function refreshPlatformCertificates(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && platformCertificateCache.certificates.length && platformCertificateCache.expiresAt > now) {
    return platformCertificateCache.certificates;
  }

  const config = ensureWechatPayConfig();
  const response = await createWechatPayGetRequest("/v3/certificates", {
    failureMessage: "获取微信支付平台证书失败",
    failureCode: "WECHAT_PAY_CERT_FETCH_FAILED",
    failureStatusCode: 500,
  });
  const certificateRows = Array.isArray(response.data && response.data.data) ? response.data.data : [];
  const certificates = certificateRows
    .map((item) => {
      const certificatePem = decryptAes256GcmText(item.encrypt_certificate, config.apiV3Key);
      const effectiveTime = new Date(item.effective_time);
      const expireTime = new Date(item.expire_time);

      if (!(certificatePem && certificatePem.trim())) {
        return null;
      }

      return {
        serialNo: String(item.serial_no || "").trim(),
        effectiveTime,
        expireTime,
        certificatePem,
        publicKey: getPlatformCertificatePublicKey(certificatePem),
      };
    })
    .filter(Boolean)
    .filter((item) => item.expireTime.getTime() > now);

  if (!certificates.length) {
    throw createWechatPayError("未获取到有效的微信支付平台证书", 500, "WECHAT_PAY_CERT_EMPTY");
  }

  const earliestExpireAt = Math.min.apply(
    null,
    certificates.map((item) => item.expireTime.getTime())
  );

  platformCertificateCache = {
    certificates,
    refreshedAt: now,
    expiresAt: Math.max(now + 60 * 1000, earliestExpireAt - CERT_REFRESH_BUFFER_MS),
  };

  return certificates;
}

async function getPlatformCertificateBySerial(serialNo) {
  const normalizedSerialNo = String(serialNo || "").trim();
  let certificates = await refreshPlatformCertificates(false);
  let matchedCertificate = certificates.find((item) => item.serialNo === normalizedSerialNo);

  if (matchedCertificate) {
    return matchedCertificate;
  }

  certificates = await refreshPlatformCertificates(true);
  matchedCertificate = certificates.find((item) => item.serialNo === normalizedSerialNo);

  if (!matchedCertificate) {
    throw createWechatPayError(
      `未找到序列号为 ${normalizedSerialNo} 的微信支付平台证书`,
      500,
      "WECHAT_PAY_CERT_NOT_FOUND"
    );
  }

  return matchedCertificate;
}

async function queryJsapiPaymentOrderByOutTradeNo(orderNo) {
  const config = ensureWechatPayConfig();
  const normalizedOrderNo = String(orderNo || "").trim();

  if (!normalizedOrderNo) {
    throw createWechatPayError("缺少商户订单号，无法查询微信支付订单", 400, "WECHAT_PAY_ORDER_NO_MISSING");
  }

  const pathname =
    config.mode === "partner"
      ? `/v3/pay/partner/transactions/out-trade-no/${encodeURIComponent(normalizedOrderNo)}?sp_mchid=${encodeURIComponent(
          config.spMchId
        )}&sub_mchid=${encodeURIComponent(config.subMchId)}`
      : `/v3/pay/transactions/out-trade-no/${encodeURIComponent(normalizedOrderNo)}?mchid=${encodeURIComponent(
          config.mchId
        )}`;
  const response = await createWechatPayGetRequest(pathname, {
    failureMessage: "查询微信支付订单失败",
    failureCode: "WECHAT_PAY_ORDER_QUERY_FAILED",
  });

  return {
    orderNo: normalizedOrderNo,
    rawResponse: response.data || null,
    transactionNo: String((response.data && response.data.transaction_id) || "").trim(),
    tradeState: String((response.data && response.data.trade_state) || "").trim().toUpperCase(),
    appId: String(
      (response.data && (response.data.appid || response.data.sub_appid || response.data.sp_appid)) || ""
    ).trim(),
    mchId: String(
      (response.data && (response.data.mchid || response.data.sub_mchid || response.data.sp_mchid)) || ""
    ).trim(),
    spAppId: String((response.data && response.data.sp_appid) || "").trim(),
    spMchId: String((response.data && response.data.sp_mchid) || "").trim(),
    subAppId: String((response.data && response.data.sub_appid) || "").trim(),
    subMchId: String((response.data && response.data.sub_mchid) || "").trim(),
    amountTotal:
      response.data && response.data.amount && Number.isFinite(Number(response.data.amount.total))
        ? Number(response.data.amount.total)
        : NaN,
  };
}

function truncateDescription(input) {
  const normalized = String(input || "").trim();
  if (!normalized) {
    return "血饮小程序订单";
  }

  const maxLength = 60;
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function normalizeWechatOpenId(value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return "";
  }

  return normalizedValue.split("::")[0];
}

async function createJsapiPayment(input = {}) {
  const config = ensureWechatPayConfig();
  const order = input.order || null;
  const user = input.user || null;
  const group = input.group || null;
  const customDescription = truncateDescription(input.description || "");

  if (!order || !order.orderNo) {
    throw createWechatPayError("缺少支付订单信息", 500, "WECHAT_PAY_ORDER_MISSING");
  }

  if (!user) {
    throw createWechatPayError("缺少支付用户信息", 500, "WECHAT_PAY_USER_MISSING");
  }

  const openId = normalizeWechatOpenId(user.openId);
  if (!openId) {
    throw createWechatPayError("当前账号缺少微信 openid，请重新登录小程序后再试", 400, "WECHAT_PAY_OPENID_MISSING");
  }

  const amountInFen = Math.round(Number(order.amount || 0) * 100);
  if (!Number.isFinite(amountInFen) || amountInFen <= 0) {
    throw createWechatPayError("订单金额无效，无法发起微信支付", 400, "WECHAT_PAY_INVALID_AMOUNT");
  }

  const descriptionPrefix = order.type === "GROUP_RENEWAL" ? "续费" : "加入";
  const description =
    customDescription || truncateDescription(`${descriptionPrefix}${group && group.name ? `-${group.name}` : "-血饮星球"}`);

  const requestPathname = config.mode === "partner" ? "/v3/pay/partner/transactions/jsapi" : "/v3/pay/transactions/jsapi";
  const requestPayload =
    config.mode === "partner"
      ? {
          sp_appid: config.spAppId || undefined,
          sp_mchid: config.spMchId,
          sub_appid: config.subAppId || undefined,
          sub_mchid: config.subMchId,
          description,
          notify_url: config.notifyUrl,
          out_trade_no: order.orderNo,
          amount: {
            total: amountInFen,
            currency: "CNY",
          },
          payer: {
            sub_openid: openId,
          },
        }
      : {
          appid: config.appId,
          mchid: config.mchId,
          description,
          notify_url: config.notifyUrl,
          out_trade_no: order.orderNo,
          amount: {
            total: amountInFen,
            currency: "CNY",
          },
          payer: {
            openid: openId,
          },
        };

  const response = await createWechatPayRequest(requestPathname, requestPayload);

  if (!response.data || !response.data.prepay_id) {
    throw createWechatPayError("微信支付下单成功，但未返回 prepay_id", 502, "WECHAT_PAY_PREPAY_ID_MISSING");
  }

  const privateKey = loadMerchantPrivateKey(config);
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = crypto.randomBytes(16).toString("hex");
  const packageValue = `prepay_id=${response.data.prepay_id}`;
  const paySignMessage = `${config.paySignAppId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
  const paySign = signMessage(privateKey, paySignMessage);

  return {
    prepayId: response.data.prepay_id,
    request: {
      appId: config.paySignAppId,
      timeStamp,
      nonceStr,
      package: packageValue,
      signType: "RSA",
      paySign,
    },
    rawResponse: response.data,
  };
}

async function requestDomesticRefund(input = {}) {
  const config = ensureWechatPayConfig();
  const outTradeNo = String(input.orderNo || input.outTradeNo || "").trim();
  const transactionId = String(input.transactionNo || input.transactionId || "").trim();
  const outRefundNo = String(input.outRefundNo || "").trim();
  const reason = truncateDescription(String(input.reason || "订单退款"));
  const refundAmount = Math.round(Number(input.refundAmountInFen || input.refundAmount || 0));
  const totalAmount = Math.round(Number(input.totalAmountInFen || input.totalAmount || 0));

  if (!outTradeNo && !transactionId) {
    throw createWechatPayError("缺少商户订单号或微信支付交易号，无法发起退款", 400, "WECHAT_PAY_REFUND_ORDER_MISSING");
  }

  if (!outRefundNo) {
    throw createWechatPayError("缺少商户退款单号，无法发起退款", 400, "WECHAT_PAY_REFUND_NO_MISSING");
  }

  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw createWechatPayError("退款金额无效，无法发起退款", 400, "WECHAT_PAY_REFUND_AMOUNT_INVALID");
  }

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw createWechatPayError("原订单金额无效，无法发起退款", 400, "WECHAT_PAY_REFUND_TOTAL_INVALID");
  }

  if (refundAmount > totalAmount) {
    throw createWechatPayError("退款金额不能大于原订单金额", 400, "WECHAT_PAY_REFUND_AMOUNT_EXCEEDED");
  }

  const requestPayload =
    config.mode === "partner"
      ? {
          sub_mchid: config.subMchId,
          transaction_id: transactionId || undefined,
          out_trade_no: outTradeNo || undefined,
          out_refund_no: outRefundNo,
          reason,
          notify_url: config.notifyUrl || undefined,
          amount: {
            refund: refundAmount,
            total: totalAmount,
            currency: "CNY",
          },
        }
      : {
          transaction_id: transactionId || undefined,
          out_trade_no: outTradeNo || undefined,
          out_refund_no: outRefundNo,
          reason,
          notify_url: config.notifyUrl || undefined,
          amount: {
            refund: refundAmount,
            total: totalAmount,
            currency: "CNY",
          },
        };

  const response = await createWechatPayRequest("/v3/refund/domestic/refunds", requestPayload);

  return {
    refundId: String((response.data && response.data.refund_id) || "").trim(),
    outRefundNo: String((response.data && response.data.out_refund_no) || outRefundNo).trim(),
    status: String((response.data && response.data.status) || "").trim().toUpperCase(),
    userReceivedAccount: String((response.data && response.data.user_received_account) || "").trim(),
    rawResponse: response.data || null,
  };
}

async function queryDomesticRefundByOutRefundNo(input = {}) {
  const config = ensureWechatPayConfig();
  const outRefundNo = String(input.outRefundNo || "").trim();

  if (!outRefundNo) {
    throw createWechatPayError("缺少商户退款单号，无法查询退款", 400, "WECHAT_PAY_REFUND_NO_MISSING");
  }

  const pathname =
    config.mode === "partner"
      ? `/v3/refund/domestic/refunds/${encodeURIComponent(outRefundNo)}?sub_mchid=${encodeURIComponent(config.subMchId)}`
      : `/v3/refund/domestic/refunds/${encodeURIComponent(outRefundNo)}`;
  const response = await createWechatPayGetRequest(pathname, {
    failureMessage: "查询微信退款状态失败",
    failureCode: "WECHAT_PAY_REFUND_QUERY_FAILED",
  });

  return {
    refundId: String((response.data && response.data.refund_id) || "").trim(),
    outRefundNo: String((response.data && response.data.out_refund_no) || outRefundNo).trim(),
    status: String((response.data && response.data.status) || "").trim().toUpperCase(),
    userReceivedAccount: String((response.data && response.data.user_received_account) || "").trim(),
    rawResponse: response.data || null,
  };
}

async function parseWechatPayNotification(input = {}) {
  const config = ensureWechatPayConfig();
  const headers = input.headers || {};
  const bodyText = String(input.bodyText || "");

  const timestamp = String(headers["wechatpay-timestamp"] || "").trim();
  const nonce = String(headers["wechatpay-nonce"] || "").trim();
  const signature = String(headers["wechatpay-signature"] || "").trim();
  const serial = String(headers["wechatpay-serial"] || "").trim();

  if (!timestamp || !nonce || !signature || !serial) {
    throw createWechatPayError("微信支付回调头缺失签名信息", 400, "WECHAT_PAY_CALLBACK_HEADER_INVALID");
  }

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > CALLBACK_TOLERANCE_MS) {
    throw createWechatPayError("微信支付回调时间戳超出允许范围，请检查服务器时间", 400, "WECHAT_PAY_CALLBACK_TIMESTAMP_INVALID");
  }

  const platformCertificate = await getPlatformCertificateBySerial(serial);
  const signatureMessage = `${timestamp}\n${nonce}\n${bodyText}\n`;
  const verified = verifyMessageSignature(platformCertificate.publicKey, signatureMessage, signature);

  if (!verified) {
    throw createWechatPayError("微信支付回调验签失败", 400, "WECHAT_PAY_CALLBACK_SIGNATURE_INVALID");
  }

  let notificationBody = {};
  try {
    notificationBody = bodyText ? JSON.parse(bodyText) : {};
  } catch (error) {
    throw createWechatPayError("微信支付回调报文不是有效 JSON", 400, "WECHAT_PAY_CALLBACK_BODY_INVALID");
  }

  const resource = notificationBody.resource ? decryptAes256GcmJson(notificationBody.resource, config.apiV3Key) : null;

  if (!resource) {
    throw createWechatPayError("微信支付回调缺少解密资源", 400, "WECHAT_PAY_CALLBACK_RESOURCE_MISSING");
  }

  return {
    headers: {
      timestamp,
      nonce,
      signature,
      serial,
    },
    body: notificationBody,
    resource,
  };
}

function buildNotifySuccessPayload() {
  return {
    code: "SUCCESS",
    message: "成功",
  };
}

function buildNotifyFailPayload(message) {
  return {
    code: "FAIL",
    message: String(message || "失败"),
  };
}

function getWechatPayResourceIdentity(resource = {}) {
  return {
    appId: String(resource.appid || resource.sub_appid || resource.sp_appid || "").trim(),
    mchId: String(resource.mchid || resource.sub_mchid || resource.sp_mchid || "").trim(),
    spAppId: String(resource.sp_appid || "").trim(),
    spMchId: String(resource.sp_mchid || "").trim(),
    subAppId: String(resource.sub_appid || "").trim(),
    subMchId: String(resource.sub_mchid || "").trim(),
  };
}

function assertWechatPayResourceMatchesConfig(resource, config = ensureWechatPayConfig()) {
  const identity = getWechatPayResourceIdentity(resource);

  if (config.mode === "partner") {
    if (identity.spAppId && config.spAppId && identity.spAppId !== config.spAppId) {
      throw createWechatPayError("回调 sp_appid 不匹配", 400, "WECHAT_PAY_CALLBACK_IDENTITY_MISMATCH");
    }

    if (identity.spMchId && identity.spMchId !== config.spMchId) {
      throw createWechatPayError("回调 sp_mchid 不匹配", 400, "WECHAT_PAY_CALLBACK_IDENTITY_MISMATCH");
    }

    if (identity.subAppId && config.subAppId && identity.subAppId !== config.subAppId) {
      throw createWechatPayError("回调 sub_appid 不匹配", 400, "WECHAT_PAY_CALLBACK_IDENTITY_MISMATCH");
    }

    if (identity.subMchId && identity.subMchId !== config.subMchId) {
      throw createWechatPayError("回调 sub_mchid 不匹配", 400, "WECHAT_PAY_CALLBACK_IDENTITY_MISMATCH");
    }

    return identity;
  }

  if (identity.appId && identity.appId !== config.appId) {
    throw createWechatPayError("回调 appid 不匹配", 400, "WECHAT_PAY_CALLBACK_IDENTITY_MISMATCH");
  }

  if (identity.mchId && identity.mchId !== config.mchId) {
    throw createWechatPayError("回调 mchid 不匹配", 400, "WECHAT_PAY_CALLBACK_IDENTITY_MISMATCH");
  }

  return identity;
}

module.exports = {
  WECHAT_PAY_API_BASE_URL,
  assertWechatPayResourceMatchesConfig,
  buildNotifyFailPayload,
  buildNotifySuccessPayload,
  createJsapiPayment,
  createWechatPayError,
  ensureWechatPayConfig,
  getWechatPayConfig,
  inspectWechatPayReadiness,
  parseWechatPayNotification,
  queryDomesticRefundByOutRefundNo,
  queryJsapiPaymentOrderByOutTradeNo,
  requestDomesticRefund,
};
