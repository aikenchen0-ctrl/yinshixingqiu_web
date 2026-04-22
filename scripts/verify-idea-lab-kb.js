const { queryKB } = require("../backend/src/services/kbService");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIdeaItemShape(item, context) {
  assert(item && typeof item === "object", `${context} 不是对象`);
  assert(typeof item.title === "string" && item.title.trim(), `${context} 缺少 title`);
  assert(typeof item.path === "string" && item.path.trim(), `${context} 缺少 path`);
  assert(Number.isInteger(item.chunkIndex) && item.chunkIndex >= 1, `${context} chunkIndex 非法`);
  assert(typeof item.score === "number" && item.score > 0, `${context} score 非法`);
  assert(Array.isArray(item.topics), `${context} topics 不是数组`);
  assert(Array.isArray(item.coreClaims), `${context} coreClaims 不是数组`);
  assert(Array.isArray(item.causalLinks), `${context} causalLinks 不是数组`);
  assert(Array.isArray(item.stances), `${context} stances 不是数组`);
  assert(Array.isArray(item.rhetoricMarkers), `${context} rhetoricMarkers 不是数组`);
  assert(typeof item.snippet === "string" && item.snippet.trim(), `${context} 缺少 snippet`);
}

async function verifyDefaultQuery(summary) {
  const results = await queryKB({
    query: "金融货币",
    limit: 6,
  });

  assert(Array.isArray(results), "默认查询结果不是数组");
  assert(results.length > 0, "默认查询未返回任何结果");
  results.forEach((item, index) => {
    assertIdeaItemShape(item, `defaultQuery[${index}]`);
  });
  assert(new Set(results.map((item) => item.path)).size === results.length, "默认查询结果存在重复文章");

  summary.defaultQuery = {
    query: "金融货币",
    count: results.length,
    firstTitle: results[0].title,
    firstTopics: results[0].topics,
    firstScore: results[0].score,
  };
}

async function verifyTopicFilter(summary) {
  const results = await queryKB({
    query: "美联储 加息 A股",
    topic: "金融货币",
    limit: 4,
  });

  assert(Array.isArray(results), "话题过滤结果不是数组");
  assert(results.length > 0, "话题过滤没有命中任何结果");
  assert(results.length <= 4, "limit 约束没有生效");
  results.forEach((item, index) => {
    assertIdeaItemShape(item, `topicFilter[${index}]`);
    assert(item.topics.includes("金融货币"), `topicFilter[${index}] 未命中过滤话题`);
  });

  summary.topicFilter = {
    query: "美联储 加息 A股",
    topic: "金融货币",
    count: results.length,
    sampleTitles: results.slice(0, 3).map((item) => item.title),
  };
}

async function verifyMismatchQuery(summary) {
  const results = await queryKB({
    query: "知识产品",
    limit: 4,
  });

  assert(Array.isArray(results), "错配查询结果不是数组");
  assert(results.length === 0, "错配查询应返回空结果，避免把无关资料推上来");

  summary.mismatchQuery = {
    query: "知识产品",
    count: results.length,
  };
}

async function main() {
  const summary = {
    ok: true,
    checks: {},
  };

  await verifyDefaultQuery(summary.checks);
  await verifyTopicFilter(summary.checks);
  await verifyMismatchQuery(summary.checks);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
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
