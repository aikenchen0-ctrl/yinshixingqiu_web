const { queryKB } = require("./kbService");
const { createChatCompletion } = require("./llmService");

const COVERAGE_TOPICS = ["中美博弈", "金融货币", "俄乌欧亚", "中东", "内政经济"];
const DEFAULT_COVERAGE_SUGGESTIONS = [
  "怎么看美联储加息和A股？",
  "如何理解中美博弈的长期主线？",
  "俄乌欧亚局势的关键变量是什么？",
  "中东局势会怎样影响全球能源与金融？",
  "内政经济当前最值得跟踪的矛盾是什么？",
];
const RETRIEVAL_NOISE_PHRASES = [
  "最值得跟踪的矛盾是什么",
  "最值得跟踪的矛盾",
  "最值得跟踪的",
  "最该跟踪哪些变量",
  "该跟踪哪些变量",
  "如何看待",
  "怎么看待",
  "如何理解",
  "怎么理解",
  "会带来什么影响",
  "会有什么影响",
  "关键变量是什么",
  "意味着什么",
  "长期主线",
  "怎么看",
  "为什么",
  "是什么",
  "有哪些",
  "当前",
  "请问",
  "一下",
  "局势",
  "到底",
];
const RETRIEVAL_TOPIC_RULES = [
  {
    topic: "金融货币",
    keywords: ["美联储", "加息", "降息", "a股", "股市", "黄金", "美元", "人民币", "汇率", "金融", "货币", "通胀", "债市", "债券"],
  },
  {
    topic: "中美博弈",
    keywords: ["中美", "博弈", "关税", "贸易战", "制裁", "特朗普", "美国", "华盛顿"],
  },
  {
    topic: "俄乌欧亚",
    keywords: ["俄乌", "乌克兰", "俄罗斯", "欧亚", "欧洲", "北约"],
  },
  {
    topic: "中东",
    keywords: ["中东", "伊朗", "以色列", "沙特", "叙利亚", "土耳其", "巴以", "石油", "原油", "能源"],
  },
  {
    topic: "内政经济",
    keywords: ["内政经济", "内需", "地产", "房地产", "就业", "消费", "财政", "制造业", "产业链"],
  },
];

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map((item) => ({
      role: item && item.role === "ai" ? "assistant" : "user",
      content: item && typeof item.content === "string" ? item.content.trim() : "",
    }))
    .filter((item) => item.content)
    .slice(-6);
}

function buildSources(results) {
  return results.map((item) => ({
    title: item.title || "未命名文章",
    date: item.date || "未知",
    snippet: item.snippet ? `${String(item.snippet).slice(0, 120)}...` : "",
  }));
}

function buildModeLabel(mode) {
  if (mode === "llm") {
    return "已结合知识库资料归纳";
  }

  if (mode === "kb_fallback") {
    return "当前为知识库直答模式";
  }

  if (mode === "kb_empty") {
    return "当前问题超出知识库覆盖，可改问血饮长期主题";
  }

  if (mode === "kb_error") {
    return "知识库暂时不可用，当前返回的是降级提示";
  }

  return "";
}

function buildCoverageHint(mode) {
  if (mode === "kb_empty" || mode === "kb_error") {
    return `当前知识库更聚焦血饮长期追踪的 ${COVERAGE_TOPICS.join("、")} 等主题，改从这些方向切入会更容易命中有效资料。`;
  }

  if (mode === "kb_fallback") {
    return "当前已命中相关资料，但智能总结服务暂时不可用；继续追问更具体的变量、周期或影响对象，会比继续泛问更有效。";
  }

  if (mode === "llm") {
    return "当前回答优先依据命中的历史资料归纳，如需继续深挖，可以追问时间窗口、关键变量或具体影响对象。";
  }

  return "";
}

function dedupeSuggestions(items) {
  const seen = new Set();

  return items.filter((item) => {
    const value = typeof item === "string" ? item.trim() : "";
    if (!value || seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function getQueryLabel(query) {
  const normalized = String(query || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "这个问题";
  }

  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

function buildTopicSuggestions(results) {
  return dedupeSuggestions(
    (results || [])
      .flatMap((item) => (Array.isArray(item.topics) ? item.topics : []))
      .slice(0, 3)
      .map((topic) => `如果只看“${topic}”，最关键的驱动变量是什么？`)
  );
}

function buildSuggestions(mode, query, results) {
  if (mode === "kb_empty" || mode === "kb_error") {
    return DEFAULT_COVERAGE_SUGGESTIONS.slice();
  }

  if (mode === "llm" || mode === "kb_fallback") {
    const queryLabel = getQueryLabel(query);
    return dedupeSuggestions(
      [
        `把“${queryLabel}”拆成三条关键因果链`,
        `如果只看未来半年，“${queryLabel}”最该跟踪哪些变量？`,
        "这件事对普通人的投资、就业和消费会有什么影响？",
      ].concat(buildTopicSuggestions(results))
    ).slice(0, 5);
  }

  return [];
}

function buildResponseData({ answer, mode, query, results }) {
  return {
    answer,
    sources: buildSources(results || []),
    mode,
    modeLabel: buildModeLabel(mode),
    coverageHint: buildCoverageHint(mode),
    suggestions: buildSuggestions(mode, query, results || []),
  };
}

function buildResultIdentity(item) {
  return [item && item.title, item && item.date, item && item.path].filter(Boolean).join("::");
}

function mergeKBResults(currentResults, nextResults, limit) {
  const merged = [];
  const seen = new Set();

  currentResults.concat(nextResults).forEach((item) => {
    const identity = buildResultIdentity(item);
    if (!identity || seen.has(identity)) {
      return;
    }
    seen.add(identity);
    merged.push(item);
  });

  return merged.slice(0, limit);
}

function buildKeywordRetrievalQuery(query) {
  let nextQuery = String(query || "").trim();
  if (!nextQuery) {
    return "";
  }

  RETRIEVAL_NOISE_PHRASES.forEach((phrase) => {
    nextQuery = nextQuery.split(phrase).join(" ");
  });

  nextQuery = nextQuery
    .replace(/[？?！!，,。；;：:“”"'‘’、/\\（）()[\]【】]/g, " ")
    .replace(/[和与及]/g, " ")
    .replace(/[的了吗呢啊呀么]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return nextQuery;
}

function buildTopicRetrievalQueries(query) {
  const normalizedQuery = String(query || "").toLowerCase();

  return RETRIEVAL_TOPIC_RULES.filter((rule) => {
    if (normalizedQuery.includes(String(rule.topic).toLowerCase())) {
      return true;
    }

    return rule.keywords.some((keyword) => normalizedQuery.includes(String(keyword).toLowerCase()));
  }).map((rule) => rule.topic);
}

function buildRetrievalQueries(query) {
  const rawQuery = String(query || "").trim();
  const keywordQuery = buildKeywordRetrievalQuery(rawQuery);
  const topicQueries = buildTopicRetrievalQueries(rawQuery);

  return dedupeSuggestions([rawQuery, keywordQuery].concat(topicQueries));
}

async function queryKBForAsk(query, limit) {
  const retrievalQueries = buildRetrievalQueries(query);
  let mergedResults = [];

  for (const retrievalQuery of retrievalQueries) {
    const nextResults = await queryKB({
      query: retrievalQuery,
      limit,
    });

    if (!Array.isArray(nextResults) || !nextResults.length) {
      continue;
    }

    mergedResults = mergeKBResults(mergedResults, nextResults, limit);
    if (mergedResults.length >= limit) {
      break;
    }
  }

  return mergedResults;
}

function buildKBContext(results) {
  return results
    .map((item, index) => {
      const claims = Array.isArray(item.coreClaims) ? item.coreClaims.slice(0, 3).join("；") : "";
      const links = Array.isArray(item.causalLinks) ? item.causalLinks.slice(0, 2).join("；") : "";
      const topics = Array.isArray(item.topics) ? item.topics.join("、") : "";
      return [
        `资料 ${index + 1}: ${item.title || "未命名文章"} (${item.date || "未知"})`,
        topics ? `主题: ${topics}` : "",
        claims ? `核心观点: ${claims}` : "",
        links ? `因果链路: ${links}` : "",
        item.snippet ? `原文片段: ${String(item.snippet).trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function buildBulletLines(results) {
  return results
    .slice(0, 3)
    .map((item, index) => {
      const coreClaim =
        Array.isArray(item.coreClaims) && item.coreClaims.length
          ? String(item.coreClaims[0]).trim()
          : "";
      const causalLink =
        Array.isArray(item.causalLinks) && item.causalLinks.length
          ? String(item.causalLinks[0]).trim()
          : "";
      const snippet = item.snippet ? String(item.snippet).trim().slice(0, 90) : "";
      const detail = coreClaim || causalLink || snippet;

      if (!detail) {
        return "";
      }

      return `${index + 1}. ${detail}`;
    })
    .filter(Boolean);
}

function buildSourceLines(results) {
  return results
    .slice(0, 3)
    .map((item) => `- 《${item.title || "未命名文章"}》(${item.date || "未知"})`)
    .filter(Boolean);
}

function buildKBFallbackAnswer(query, results, reason) {
  const bulletLines = buildBulletLines(results);
  const sourceLines = buildSourceLines(results);
  const suffix = reason ? `当前智能总结服务暂时不可用，先切换为知识库直出模式。` : "";

  return [
    `关于“${query}”，我先基于现有知识库给你一个保守回答。`,
    bulletLines.length
      ? bulletLines.join("\n")
      : "目前检索到了相关资料，但可直接提炼的结论比较有限，建议你继续追问更具体的场景、目标或约束。",
    sourceLines.length ? `这次主要参考了以下资料：\n${sourceLines.join("\n")}` : "",
    [suffix, "如果你愿意继续追问，我可以继续按现有资料把某个点展开。"].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildKBEmptyAnswer(query) {
  return [
    `关于“${query}”，知识库中暂未找到足够相关的历史内容。`,
    `当前语料更集中在 ${COVERAGE_TOPICS.join("、")} 这些长期主题，你可以直接换成这些方向，或者把问题改写成更偏宏观、地缘或金融框架的问法。`,
  ].join(" ");
}

function buildKBErrorAnswer(query) {
  return `关于“${query}”，知识库检索服务暂时不可用，所以我现在没法基于资料给出可靠结论。你可以稍后重试，或者优先改问 ${COVERAGE_TOPICS.join("、")} 这些长期主题中的具体问题。`;
}

async function askAIWithKB(input = {}) {
  try {
    const query = String(input.query || "").trim();
    const history = normalizeHistory(input.history);

    if (!query) {
      return { statusCode: 400, payload: { ok: false, message: "请输入问题" } };
    }

    let results = [];

    try {
      results = await queryKBForAsk(query, 5);
    } catch (error) {
      console.error("[aiService] kb query failed", error instanceof Error ? error.message : error);
      return {
        statusCode: 200,
        payload: {
          ok: true,
          message: "知识库检索服务暂时不可用，已返回降级提示",
          data: buildResponseData({
            answer: buildKBErrorAnswer(query),
            mode: "kb_error",
            query,
            results: [],
          }),
        },
      };
    }

    if (!results || !results.length) {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          data: buildResponseData({
            answer: buildKBEmptyAnswer(query),
            mode: "kb_empty",
            query,
            results: [],
          }),
        },
      };
    }

    const kbContext = buildKBContext(results);
    const messages = [
      {
        role: "system",
        content:
          "你是AI问血饮的中文助手。你的任务是基于给定知识库资料回答用户问题。要求：1. 优先依据知识库，不要编造资料外事实；2. 语气自然，像真人分析，不要用固定模板标题；3. 可以做归纳，但要明确哪些判断来自资料；4. 如果资料不足，要直接说明不足；5. 回答控制在 3 到 6 段，避免太像报告。",
      },
      {
        role: "system",
        content: `以下是与当前问题相关的知识库资料，请优先依据这些内容回答：\n\n${kbContext}`,
      },
      ...history.map((item) => ({
        role: item.role,
        content: item.content,
      })),
      {
        role: "user",
        content: query,
      },
    ];

    try {
      const completion = await createChatCompletion(messages, {
        temperature: 0.5,
        timeoutMs: 10000,
      });

      return {
        statusCode: 200,
        payload: {
          ok: true,
          data: buildResponseData({
            answer: completion.content,
            mode: "llm",
            query,
            results,
          }),
        },
      };
    } catch (error) {
      console.error("[aiService] llm fallback activated", error instanceof Error ? error.message : error);
      return {
        statusCode: 200,
        payload: {
          ok: true,
          message: "真实 AI 总结暂时不可用，已切换为知识库回答",
          data: buildResponseData({
            answer: buildKBFallbackAnswer(
              query,
              results,
              error instanceof Error ? error.message : "真实 AI 问答暂时不可用"
            ),
            mode: "kb_fallback",
            query,
            results,
          }),
        },
      };
    }
  } catch (error) {
    const query = String(input.query || "").trim();
    console.error("[aiService] unexpected failure", error instanceof Error ? error.stack || error.message : error);

    if (!query) {
      return { statusCode: 400, payload: { ok: false, message: "请输入问题" } };
    }

    return {
      statusCode: 200,
      payload: {
        ok: true,
        message: "AI 问答服务出现异常，已返回降级提示",
        data: buildResponseData({
          answer: buildKBErrorAnswer(query),
          mode: "kb_error",
          query,
          results: [],
        }),
      },
    };
  }
}

module.exports = {
  askAIWithKB,
};
