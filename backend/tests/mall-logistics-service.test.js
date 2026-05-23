const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeMallLogisticsCompanyCode,
  parseKuaidiCompanyCandidates,
  normalizeMallLogisticsTimeline,
  shouldUseMallLogisticsTimeline,
} = require("../src/services/mallLogisticsService");

test("normalizeMallLogisticsCompanyCode maps common chinese carrier names", () => {
  assert.equal(normalizeMallLogisticsCompanyCode("申通"), "shentong");
  assert.equal(normalizeMallLogisticsCompanyCode("申通快递"), "shentong");
  assert.equal(normalizeMallLogisticsCompanyCode("圆通"), "yuantong");
  assert.equal(normalizeMallLogisticsCompanyCode("未知物流"), "");
});

test("parseKuaidiCompanyCandidates extracts first recognized company candidates", () => {
  const payload = JSON.stringify([
    { name: "申通快递", exname: "shentong" },
    { name: "圆通速递", exname: "yuantong" },
  ]);

  assert.deepEqual(parseKuaidiCompanyCandidates(payload), [
    { name: "申通快递", code: "shentong" },
    { name: "圆通速递", code: "yuantong" },
  ]);
});

test("normalizeMallLogisticsTimeline removes invalid timeline rows", () => {
  const result = normalizeMallLogisticsTimeline([
    { time: "2026-04-22 10:00:00", context: "已揽收" },
    { time: "", context: "空时间" },
    { time: "2026-04-22 11:00:00", context: "" },
  ]);

  assert.deepEqual(result, [{ time: "2026-04-22 10:00:00", status: "已揽收" }]);
});

test("shouldUseMallLogisticsTimeline rejects obvious invalid timeline payloads", () => {
  assert.equal(
    shouldUseMallLogisticsTimeline([{ time: "2026-04-10 15:21:04", status: "查无结果" }]),
    false,
  );

  assert.equal(
    shouldUseMallLogisticsTimeline([{ time: "2026-04-22 13:45:10", status: "您的订单已被收件员揽收" }]),
    true,
  );
});
