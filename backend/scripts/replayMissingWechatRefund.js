const { prisma } = require("../src/db/prisma");
const { repairMissingWechatRefundByOrderNo } = require("../src/services/planetService");

async function listRecentCandidates() {
  const rows = await prisma.order.findMany({
    where: {
      type: "GROUP_JOIN",
      paymentStatus: "REFUNDED",
    },
    include: {
      paymentRecords: {
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 20,
  });

  const candidates = rows
    .map((order) => {
      const payment = order.paymentRecords && order.paymentRecords.length ? order.paymentRecords[0] : null;
      const rawPayload = payment && payment.rawPayload && typeof payment.rawPayload === "object" ? payment.rawPayload : {};
      const refundOutNo = String(rawPayload.wechatRefundOutNo || "").trim();
      const refundStatus = String(rawPayload.wechatRefundStatus || "").trim().toUpperCase();

      if (refundOutNo || refundStatus) {
        return null;
      }

      return {
        orderNo: order.orderNo,
        amountFen: Math.round(Number(order.amount || 0) * 100),
        updatedAt: order.updatedAt.toISOString(),
      };
    })
    .filter(Boolean);

  console.log(JSON.stringify({ ok: true, candidates }, null, 2));
}

async function main() {
  const orderNo = String(process.argv[2] || "").trim();

  if (!orderNo) {
    await listRecentCandidates();
    return;
  }

  const result = await repairMissingWechatRefundByOrderNo(orderNo);
  console.log(JSON.stringify({ ok: true, result }, null, 2));
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
