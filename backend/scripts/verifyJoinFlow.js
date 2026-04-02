const {
  buildPreview,
  createJoinOrder,
  applyPaymentSuccess,
  getMembershipStatus,
} = require("../src/services/joinFlowService");
const { ensureDemoData } = require("../src/db/seedDemoData");
const { prisma } = require("../src/db/prisma");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  await ensureDemoData({ resetRuntime: true });

  const preview = await buildPreview(
    "grp_datawhale_001",
    "usr_buyer_001",
    "NEW1000",
    "CH_WECHAT_MENU_001"
  );
  assert(preview.statusCode === 200, "预览页查询失败");
  assert(preview.payload.data.pricing.payableAmount === 4000, "优惠价格计算不正确");

  const orderResult = await createJoinOrder({
    groupId: "grp_datawhale_001",
    userId: "usr_buyer_001",
    couponCode: "NEW1000",
    channelCode: "CH_WECHAT_MENU_001",
    paymentChannel: "WECHAT",
  });
  assert(orderResult.statusCode === 201, "创建订单失败");

  const orderNo = orderResult.payload.data.order.orderNo;
  const paidResult = await applyPaymentSuccess({
    orderNo,
    transactionNo: "WX_VERIFY_0001",
    success: true,
  });
  assert(paidResult.statusCode === 200, "支付回调失败");
  assert(paidResult.payload.data.order.status === "PAID", "订单未变成已支付");

  const membership = await getMembershipStatus("grp_datawhale_001", "usr_buyer_001");
  assert(membership.payload.data && membership.payload.data.isActive, "成员资格未开通");

  console.log(
    JSON.stringify(
      {
        ok: true,
        orderNo,
        payableAmount: preview.payload.data.pricing.payableAmount,
        membershipStatus: membership.payload.data.status,
        memberExpireAt: membership.payload.data.expireAt,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
