const http = require("http");
const https = require("https");

function getLLMConfig() {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  const baseUrl = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
  const model = String(process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();

  if (!apiKey) {
    throw new Error("未配置 OPENAI_API_KEY，暂时无法启用真实 AI 问答");
  }

  return {
    apiKey,
    baseUrl,
    model,
  };
}

function postJson(url, payload, apiKey, timeoutMs) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const body = JSON.stringify(payload || {});
    const isHttps = requestUrl.protocol === "https:";
    const requestLib = isHttps ? https : http;

    const req = requestLib.request(
      {
        hostname: requestUrl.hostname,
        port: requestUrl.port,
        path: `${requestUrl.pathname}${requestUrl.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${apiKey}`,
        },
      },
      (response) => {
        let responseBody = "";

        response.on("data", (chunk) => {
          responseBody += chunk;
        });

        response.on("end", () => {
          let data = null;
          try {
            data = JSON.parse(responseBody || "{}");
          } catch (error) {
            reject(new Error("大模型接口返回了无法解析的内容"));
            return;
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            const message =
              (data && data.error && (data.error.message || data.error.code)) ||
              `大模型接口请求失败，状态码 ${response.statusCode}`;
            reject(new Error(message));
            return;
          }

          resolve(data);
        });
      }
    );

    req.setTimeout(Math.max(1000, Number(timeoutMs) || 10000), () => {
      req.destroy(new Error(`大模型接口请求超时 (${timeoutMs}ms)`));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function createChatCompletion(messages, options = {}) {
  const { apiKey, baseUrl, model } = getLLMConfig();
  const timeoutMs = Number(options.timeoutMs || process.env.OPENAI_TIMEOUT_MS || 10000);
  const payload = {
    model: options.model || model,
    messages,
    temperature: options.temperature === undefined ? 0.4 : options.temperature,
  };

  const result = await postJson(`${baseUrl}/chat/completions`, payload, apiKey, timeoutMs);
  const content =
    result &&
    Array.isArray(result.choices) &&
    result.choices[0] &&
    result.choices[0].message &&
    typeof result.choices[0].message.content === "string"
      ? result.choices[0].message.content.trim()
      : "";

  if (!content) {
    throw new Error("大模型没有返回有效内容");
  }

  return {
    content,
    raw: result,
  };
}

module.exports = {
  createChatCompletion,
};
