const aiServicePath = require.resolve("../backend/src/services/aiService");
const kbServicePath = require.resolve("../backend/src/services/kbService");
const llmServicePath = require.resolve("../backend/src/services/llmService");

const originalKbModule = require.cache[kbServicePath];
const originalLlmModule = require.cache[llmServicePath];
const originalAiModule = require.cache[aiServicePath];
const originalKbExports = require(kbServicePath);
const originalLlmExports = require(llmServicePath);

const SAMPLE_RESULTS = [
  {
    title: "血饮原创|抄底之战:美联储强行加息开启对华金融战",
    date: "2023-06-18",
    snippet: "美联储强行加息的核心目标，是通过美元流动性收缩压制全球风险资产，并把压力向新兴市场传导。",
    coreClaims: ["美联储加息本质上是金融战的一部分"],
    causalLinks: ["美元收缩会先压制风险资产，再外溢到A股和人民币预期"],
    topics: ["金融货币", "中美博弈"],
  },
  {
    title: "新闻综述|A股徘徊在美联储加息会议的大门外",
    date: "2023-07-27",
    snippet: "A股对加息预期的反应，往往要和美元指数、北向资金、人民币汇率一起看。",
    coreClaims: ["A股对外部流动性冲击比较敏感"],
    causalLinks: ["美元指数走强会通过汇率和资金偏好影响A股"],
    topics: ["金融货币"],
  },
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function restoreModuleCache() {
  if (originalKbModule) {
    require.cache[kbServicePath] = originalKbModule;
  } else {
    delete require.cache[kbServicePath];
  }

  if (originalLlmModule) {
    require.cache[llmServicePath] = originalLlmModule;
  } else {
    delete require.cache[llmServicePath];
  }

  if (originalAiModule) {
    require.cache[aiServicePath] = originalAiModule;
  } else {
    delete require.cache[aiServicePath];
  }
}

function loadAskAIWithKB(mocks = {}) {
  delete require.cache[aiServicePath];

  require.cache[kbServicePath] = {
    id: kbServicePath,
    filename: kbServicePath,
    loaded: true,
    exports: {
      queryKB: mocks.queryKB || originalKbExports.queryKB,
    },
  };

  require.cache[llmServicePath] = {
    id: llmServicePath,
    filename: llmServicePath,
    loaded: true,
    exports: {
      createChatCompletion: mocks.createChatCompletion || originalLlmExports.createChatCompletion,
    },
  };

  return require(aiServicePath).askAIWithKB;
}

function assertBaseShape(result, context) {
  assert(result && typeof result === "object", `${context} 返回结果不是对象`);
  assert(result.statusCode === 200, `${context} 状态码异常: ${result.statusCode}`);
  assert(result.payload && result.payload.ok === true, `${context} payload.ok 异常`);
  assert(result.payload.data && typeof result.payload.data.answer === "string" && result.payload.data.answer.trim(), `${context} answer 为空`);
  assert(typeof result.payload.data.mode === "string" && result.payload.data.mode.trim(), `${context} mode 缺失`);
  assert(typeof result.payload.data.modeLabel === "string" && result.payload.data.modeLabel.trim(), `${context} modeLabel 缺失`);
  assert(typeof result.payload.data.coverageHint === "string" && result.payload.data.coverageHint.trim(), `${context} coverageHint 缺失`);
  assert(Array.isArray(result.payload.data.suggestions), `${context} suggestions 不是数组`);
  assert(result.payload.data.suggestions.length > 0, `${context} suggestions 为空`);
  assert(Array.isArray(result.payload.data.sources), `${context} sources 不是数组`);
}

function assertSuggestionsShape(suggestions, context) {
  suggestions.forEach((item, index) => {
    assert(typeof item === "string" && item.trim(), `${context}[${index}] 非法`);
  });
}

async function verifyLLMMode(summary) {
  const attemptedQueries = [];
  const askAIWithKB = loadAskAIWithKB({
    queryKB: async ({ query }) => {
      attemptedQueries.push(query);
      if (query === "怎么看美联储加息和A股？") {
        return [];
      }
      if (query === "美联储加息 A股") {
        return SAMPLE_RESULTS;
      }
      return [];
    },
    createChatCompletion: async () => ({
      content: "这是基于知识库资料归纳出的结论，核心变量仍然是美元流动性、人民币汇率和A股风险偏好。",
    }),
  });

  const result = await askAIWithKB({
    query: "怎么看美联储加息和A股？",
  });

  assertBaseShape(result, "llm");
  assert(result.payload.data.mode === "llm", `llm mode 异常: ${result.payload.data.mode}`);
  assert(result.payload.data.sources.length === SAMPLE_RESULTS.length, "llm sources 数量异常");
  assertSuggestionsShape(result.payload.data.suggestions, "llm suggestions");
  assert(attemptedQueries[0] === "怎么看美联储加息和A股？", "llm 首次检索 query 不正确");
  assert(attemptedQueries.includes("美联储加息 A股"), "llm 未触发自然问句简化检索");

  summary.llm = {
    mode: result.payload.data.mode,
    sourceCount: result.payload.data.sources.length,
    firstSuggestion: result.payload.data.suggestions[0],
    retrievalQueries: attemptedQueries,
  };
}

async function verifyKBFallbackMode(summary) {
  const askAIWithKB = loadAskAIWithKB({
    queryKB: async () => SAMPLE_RESULTS,
    createChatCompletion: async () => {
      throw new Error("mock llm down");
    },
  });

  const result = await askAIWithKB({
    query: "怎么看美联储加息和A股？",
  });

  assertBaseShape(result, "kb_fallback");
  assert(result.payload.data.mode === "kb_fallback", `kb_fallback mode 异常: ${result.payload.data.mode}`);
  assert(result.payload.data.sources.length === SAMPLE_RESULTS.length, "kb_fallback sources 数量异常");
  assert(result.payload.data.answer.includes("知识库"), "kb_fallback answer 未体现知识库降级");
  assertSuggestionsShape(result.payload.data.suggestions, "kb_fallback suggestions");

  summary.kbFallback = {
    mode: result.payload.data.mode,
    sourceCount: result.payload.data.sources.length,
    firstSuggestion: result.payload.data.suggestions[0],
  };
}

async function verifyKBEmptyMode(summary) {
  const askAIWithKB = loadAskAIWithKB({
    queryKB: async () => [],
  });

  const result = await askAIWithKB({
    query: "知识产品",
  });

  assertBaseShape(result, "kb_empty");
  assert(result.payload.data.mode === "kb_empty", `kb_empty mode 异常: ${result.payload.data.mode}`);
  assert(result.payload.data.sources.length === 0, "kb_empty sources 应为空");
  assert(result.payload.data.coverageHint.includes("金融货币"), "kb_empty coverageHint 未包含金融货币");
  assert(result.payload.data.coverageHint.includes("中美博弈"), "kb_empty coverageHint 未包含中美博弈");
  assertSuggestionsShape(result.payload.data.suggestions, "kb_empty suggestions");

  summary.kbEmpty = {
    mode: result.payload.data.mode,
    suggestionCount: result.payload.data.suggestions.length,
    firstSuggestion: result.payload.data.suggestions[0],
  };
}

async function verifyKBErrorMode(summary) {
  const askAIWithKB = loadAskAIWithKB({
    queryKB: async () => {
      throw new Error("mock kb down");
    },
  });

  const result = await askAIWithKB({
    query: "金融货币",
  });

  assertBaseShape(result, "kb_error");
  assert(result.payload.data.mode === "kb_error", `kb_error mode 异常: ${result.payload.data.mode}`);
  assert(result.payload.data.sources.length === 0, "kb_error sources 应为空");
  assert(result.payload.message === "知识库检索服务暂时不可用，已返回降级提示", "kb_error message 异常");
  assertSuggestionsShape(result.payload.data.suggestions, "kb_error suggestions");

  summary.kbError = {
    mode: result.payload.data.mode,
    suggestionCount: result.payload.data.suggestions.length,
    firstSuggestion: result.payload.data.suggestions[0],
  };
}

async function main() {
  const summary = {
    ok: true,
    checks: {},
  };

  try {
    await verifyLLMMode(summary.checks);
    await verifyKBFallbackMode(summary.checks);
    await verifyKBEmptyMode(summary.checks);
    await verifyKBErrorMode(summary.checks);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    restoreModuleCache();
  }
}

main().catch((error) => {
  restoreModuleCache();
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
