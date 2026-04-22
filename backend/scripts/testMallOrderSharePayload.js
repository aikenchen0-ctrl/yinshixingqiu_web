const assert = require("assert/strict");

process.env.PRISMA_AUTO_SYNC = "0";

const mallService = require("../src/services/mallService");

const buildMallOrderPayload = mallService.__test__ && mallService.__test__.buildMallOrderPayload;

assert.equal(
  typeof buildMallOrderPayload,
  "function",
  "Expected mallService.__test__.buildMallOrderPayload to be exposed for payload verification.",
);

const shareSharer = {
  id: "user_share_12345678",
  nickname: "分享达人",
  mobile: "13800001111",
};

const payload = buildMallOrderPayload(
  {
    id: "order_001",
    groupId: "grp_datawhale_001",
    userId: "buyer_001",
    orderNo: "M202604220001",
    status: "PAID",
    totalAmount: 299,
    payableAmount: 299,
    shareSharerUserId: shareSharer.id,
    shareProductId: "prod_001",
    shareCommissionRate: 0.1,
    shareCommissionBaseAmount: 299,
    shareCommissionAmount: 29.9,
    shareCommissionStatus: "PENDING",
    shippingStatus: "PENDING",
    refundStatus: "NONE",
    shippingRecipientName: "张三",
    shippingRecipientPhone: "13900002222",
    shippingProvince: "浙江省",
    shippingCity: "杭州市",
    shippingDistrict: "西湖区",
    shippingDetailAddress: "学院路 1 号",
    createdAt: new Date("2026-04-22T10:00:00.000Z"),
    updatedAt: new Date("2026-04-22T10:05:00.000Z"),
    items: [
      {
        id: "item_001",
        productId: "prod_001",
        productTitle: "测试商品",
        productSubtitle: "测试副标题",
        quantity: 1,
        unitPrice: 299,
        totalAmount: 299,
        createdAt: new Date("2026-04-22T10:00:00.000Z"),
      },
    ],
  },
  {
    shareUserMap: {
      [shareSharer.id]: shareSharer,
    },
  },
);

assert.deepEqual(
  payload.shareSharer,
  shareSharer,
  "Expected order payload to expose explicit shareSharer information for admin order management.",
);

assert.deepEqual(
  payload.shareCommissionRecipient,
  shareSharer,
  "Expected legacy shareCommissionRecipient to remain compatible with existing consumers.",
);

console.log("share sharer payload test passed");
