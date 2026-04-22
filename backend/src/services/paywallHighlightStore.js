const fs = require("fs");
const path = require("path");

const PAYWALL_HIGHLIGHT_STORE_PATH = path.join(__dirname, "..", "..", "temp", "admin-paywall-highlights.json");

function normalizePaywallHighlightUrl(url) {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) {
    return "";
  }

  if (/^\//.test(normalizedUrl)) {
    return normalizedUrl;
  }

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return normalizedUrl;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    if (!/^\/uploads(?:\/|$)/i.test(parsedUrl.pathname)) {
      return normalizedUrl;
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch (error) {
    return normalizedUrl;
  }
}

function readJsonStore(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallbackValue;
    }

    const rawValue = fs.readFileSync(filePath, "utf8").trim();
    if (!rawValue) {
      return fallbackValue;
    }

    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" ? parsed : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

function normalizePaywallHighlightImage(item, index) {
  const url = normalizePaywallHighlightUrl(item && item.url ? item.url : "");
  if (!url || !/^(https?:\/\/|\/)/i.test(url)) {
    return null;
  }

  const name = String(item && item.name ? item.name : `亮点图${index + 1}`)
    .trim()
    .slice(0, 120);

  return {
    name: name || `亮点图${index + 1}`,
    url,
  };
}

function getPaywallHighlightSnapshot(groupId) {
  if (!groupId) {
    return {
      images: [],
      updatedAt: "",
    };
  }

  const store = readJsonStore(PAYWALL_HIGHLIGHT_STORE_PATH, {});
  const snapshot = store[groupId] && typeof store[groupId] === "object" ? store[groupId] : {};
  const images = Array.isArray(snapshot.images)
    ? snapshot.images.map((item, index) => normalizePaywallHighlightImage(item, index)).filter(Boolean)
    : [];

  return {
    images,
    updatedAt: typeof snapshot.updatedAt === "string" ? snapshot.updatedAt : "",
  };
}

module.exports = {
  getPaywallHighlightSnapshot,
  normalizePaywallHighlightImage,
  normalizePaywallHighlightUrl,
};
