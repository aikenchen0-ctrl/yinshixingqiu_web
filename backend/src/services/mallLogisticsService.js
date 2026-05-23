const COMPANY_CODE_ALIASES = {
  shentong: ["shentong", "申通", "申通快递"],
  yuantong: ["yuantong", "圆通", "圆通速递"],
  yunda: ["yunda", "韵达", "韵达快递"],
  zhongtong: ["zhongtong", "中通", "中通快递"],
  shunfeng: ["shunfeng", "顺丰", "顺丰速运", "sf", "sfexpress"],
  jd: ["jd", "京东", "京东快递", "京东物流"],
  ems: ["ems", "邮政", "中国邮政", "ems快递"],
  jtexpress: ["jtexpress", "极兔", "极兔速递"],
};

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMallLogisticsCompanyCode(value) {
  const normalizedValue = normalizeString(value).toLowerCase();
  if (!normalizedValue) {
    return "";
  }

  for (const [code, aliases] of Object.entries(COMPANY_CODE_ALIASES)) {
    if (aliases.some((alias) => alias.toLowerCase() === normalizedValue)) {
      return code;
    }
  }

  return "";
}

function parseKuaidiCompanyCandidates(payloadText) {
  let parsed = [];

  try {
    parsed = JSON.parse(String(payloadText || "[]"));
  } catch {
    parsed = [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => ({
      name: normalizeString(item && item.name),
      code: normalizeMallLogisticsCompanyCode(item && (item.exname || item.name)),
    }))
    .filter((item) => item.name && item.code);
}

function normalizeMallLogisticsTimeline(rawItems) {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems
    .map((item) => ({
      time: normalizeString(item && item.time),
      status: normalizeString(item && (item.context || item.status)),
    }))
    .filter((item) => item.time && item.status);
}

function shouldUseMallLogisticsTimeline(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return false;
  }

  return timeline.every((item) => !/查无结果/i.test(String(item.status || "")));
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 mall logistics bot",
      accept: "application/json,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`物流接口请求失败: ${response.status}`);
  }

  return response.text();
}

async function detectMallLogisticsCompany(trackingNo) {
  const normalizedTrackingNo = normalizeString(trackingNo);
  if (!normalizedTrackingNo) {
    return { company: "", companyCode: "" };
  }

  const responseText = await fetchText(
    `http://www.kuaidi.com/index-ajaxselectinfo-${encodeURIComponent(normalizedTrackingNo)}.html`,
  );
  const candidates = parseKuaidiCompanyCandidates(responseText);
  const firstCandidate = candidates[0] || null;

  return firstCandidate
    ? { company: firstCandidate.name, companyCode: firstCandidate.code }
    : { company: "", companyCode: "" };
}

function parseKuaidiTimelinePayload(payloadText) {
  let parsed = null;

  try {
    parsed = JSON.parse(String(payloadText || "{}"));
  } catch {
    parsed = null;
  }

  const data = parsed && parsed.success && Array.isArray(parsed.data) ? parsed.data : [];
  return normalizeMallLogisticsTimeline(data);
}

async function queryMallLogisticsTimeline(input = {}) {
  const trackingNo = normalizeString(input.trackingNo);
  const companyCode =
    normalizeMallLogisticsCompanyCode(input.companyCode) ||
    normalizeMallLogisticsCompanyCode(input.company);

  if (!trackingNo) {
    return {
      queryMode: "fallback_only",
      company: normalizeString(input.company),
      companyCode,
      trackingNo: "",
      latestStatus: "",
      latestTime: "",
      timeline: [],
      fallbackReason: "missing_tracking_no",
    };
  }

  let resolvedCompany = normalizeString(input.company);
  let resolvedCompanyCode = companyCode;

  if (!resolvedCompanyCode) {
    const detected = await detectMallLogisticsCompany(trackingNo);
    resolvedCompany = resolvedCompany || detected.company;
    resolvedCompanyCode = detected.companyCode;
  }

  if (!resolvedCompanyCode) {
    return {
      queryMode: "fallback_only",
      company: resolvedCompany,
      companyCode: "",
      trackingNo,
      latestStatus: "",
      latestTime: "",
      timeline: [],
      fallbackReason: "carrier_not_resolved",
    };
  }

  try {
    const responseText = await fetchText(
      `http://www.kuaidi.com/index-ajaxselectcourierinfo-${encodeURIComponent(trackingNo)}-${encodeURIComponent(resolvedCompanyCode)}.html`,
    );
    const timeline = parseKuaidiTimelinePayload(responseText);

    if (!shouldUseMallLogisticsTimeline(timeline)) {
      return {
        queryMode: "fallback_only",
        company: resolvedCompany,
        companyCode: resolvedCompanyCode,
        trackingNo,
        latestStatus: "",
        latestTime: "",
        timeline: [],
        fallbackReason: "timeline_not_reliable",
      };
    }

    const latestItem = timeline[0] || { time: "", status: "" };

    return {
      queryMode: "timeline_available",
      company: resolvedCompany,
      companyCode: resolvedCompanyCode,
      trackingNo,
      latestStatus: latestItem.status,
      latestTime: latestItem.time,
      timeline,
      fallbackReason: "",
    };
  } catch {
    return {
      queryMode: "fallback_only",
      company: resolvedCompany,
      companyCode: resolvedCompanyCode,
      trackingNo,
      latestStatus: "",
      latestTime: "",
      timeline: [],
      fallbackReason: "provider_request_failed",
    };
  }
}

module.exports = {
  normalizeMallLogisticsCompanyCode,
  parseKuaidiCompanyCandidates,
  normalizeMallLogisticsTimeline,
  shouldUseMallLogisticsTimeline,
  detectMallLogisticsCompany,
  queryMallLogisticsTimeline,
};
