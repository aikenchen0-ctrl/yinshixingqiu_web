const { prisma } = require("../src/db/prisma");

function parseArgs(argv) {
  const args = {
    mobile: "",
    mobileLike: "",
    groupId: "",
    groupNameLike: "",
    orderNo: "",
    price: "1",
    apply: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = String(argv[index] || "").trim();
    const value = String(argv[index + 1] || "").trim();

    if (key === "--mobile") {
      args.mobile = value;
      index += 1;
      continue;
    }

    if (key === "--mobile-like") {
      args.mobileLike = value;
      index += 1;
      continue;
    }

    if (key === "--group-id") {
      args.groupId = value;
      index += 1;
      continue;
    }

    if (key === "--group-name-like") {
      args.groupNameLike = value;
      index += 1;
      continue;
    }

    if (key === "--order-no") {
      args.orderNo = value;
      index += 1;
      continue;
    }

    if (key === "--price") {
      args.price = value;
      index += 1;
      continue;
    }

    if (key === "--apply") {
      args.apply = true;
    }
  }

  return args;
}

function getDurationDays(group) {
  return group.billingPeriod === "YEAR"
    ? 365
    : group.billingPeriod === "QUARTER"
      ? 90
      : group.billingPeriod === "MONTH"
        ? 30
        : 3650;
}

function buildExpireAt(group, paidAt) {
  const baseDate = paidAt instanceof Date && !Number.isNaN(paidAt.getTime()) ? paidAt : new Date();
  return new Date(baseDate.getTime() + getDurationDays(group) * 24 * 60 * 60 * 1000);
}

function sanitizeRefundPayload(rawPayload) {
  const current = rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload) ? { ...rawPayload } : {};

  return {
    ...current,
    refundReason: "",
    refundAppliedAt: "",
    refundReviewRequired: false,
    refundReviewStatus: "",
    refundReviewReason: "",
    refundRequestedAt: "",
    refundReviewedAt: "",
    refundReviewerUserId: "",
    wechatRefundOutNo: "",
    wechatRefundId: "",
    wechatRefundStatus: "",
    wechatRefundRequestedAt: "",
    wechatRefundSuccessAt: "",
    wechatRefundUserReceivedAccount: "",
    wechatRefundReason: "",
    wechatRefundRawResponse: {},
    refundRestoreAppliedAt: new Date().toISOString(),
  };
}

async function syncActiveMemberAggregates(tx, groupId) {
  const now = new Date();
  const activeMemberWhere = {
    groupId,
    status: "ACTIVE",
    OR: [{ expireAt: null }, { expireAt: { gt: now } }],
  };

  const [memberCount, paidMemberCount] = await Promise.all([
    tx.groupMember.count({ where: activeMemberWhere }),
    tx.groupMember.count({
      where: {
        ...activeMemberWhere,
        isPaid: true,
      },
    }),
  ]);

  await tx.group.update({
    where: { id: groupId },
    data: {
      memberCount,
      paidMemberCount,
    },
  });
}

async function resolveUser(args) {
  if (!args.mobile && !args.mobileLike && !args.orderNo) {
    throw new Error("请至少提供 --mobile、--mobile-like 或 --order-no 之一");
  }

  if (args.orderNo) {
    const order = await prisma.order.findUnique({
      where: { orderNo: args.orderNo },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error("指定订单不存在");
    }

    return order.user;
  }

  const users = await prisma.user.findMany({
    where: args.mobile
      ? { mobile: args.mobile }
      : {
          mobile: {
            contains: args.mobileLike,
          },
        },
    include: {
      profile: true,
    },
    take: 10,
  });

  if (!users.length) {
    throw new Error("没有找到对应手机号用户");
  }

  if (users.length > 1) {
    throw new Error(
      `匹配到多个用户，请改用更精确的手机号：${users
        .map((item) => `${item.id}:${item.mobile || ""}:${item.profile && item.profile.nickname ? item.profile.nickname : ""}`)
        .join(" | ")}`
    );
  }

  return users[0];
}

async function resolveCandidate(args, user) {
  const where = {
    userId: user.id,
    type: "GROUP_JOIN",
    ...(args.orderNo ? { orderNo: args.orderNo } : {}),
    ...(args.groupId ? { groupId: args.groupId } : {}),
    ...(args.groupId || args.orderNo
      ? {}
      : {
          group: {
            priceAmount: Number(args.price || 1),
            ...(args.groupNameLike
              ? {
                  name: {
                    contains: args.groupNameLike,
                  },
                }
              : {}),
          },
        }),
  };

  const orders = await prisma.order.findMany({
    where,
    include: {
      group: true,
      paymentRecords: {
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 10,
  });

  if (!orders.length) {
    throw new Error("没有找到该用户在目标星球的加入订单");
  }

  if (orders.length > 1 && !args.orderNo && !args.groupId) {
    throw new Error(
      `匹配到多个候选订单，请补充 --order-no 或 --group-id：${orders
        .map((item) => `${item.orderNo}:${item.group ? item.group.name : ""}:${item.groupId || ""}`)
        .join(" | ")}`
    );
  }

  const order = orders[0];
  const payment = order.paymentRecords && order.paymentRecords.length ? order.paymentRecords[0] : null;
  if (!payment) {
    throw new Error("候选订单缺少支付记录");
  }

  const membership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: order.groupId,
        userId: user.id,
      },
    },
  });

  return {
    order,
    payment,
    membership,
  };
}

function printPreview(user, candidate) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        preview: {
          user: {
            id: user.id,
            mobile: user.mobile || "",
            nickname: user.profile && user.profile.nickname ? user.profile.nickname : "",
          },
          group: candidate.order.group
            ? {
                id: candidate.order.group.id,
                name: candidate.order.group.name,
                priceAmount: String(candidate.order.group.priceAmount),
                billingPeriod: candidate.order.group.billingPeriod,
              }
            : null,
          order: {
            id: candidate.order.id,
            orderNo: candidate.order.orderNo,
            status: candidate.order.status,
            paymentStatus: candidate.order.paymentStatus,
            amount: String(candidate.order.amount),
            paidAt: candidate.order.paidAt ? candidate.order.paidAt.toISOString() : "",
          },
          payment: {
            id: candidate.payment.id,
            status: candidate.payment.status,
            transactionNo: candidate.payment.transactionNo || "",
            paidAt: candidate.payment.paidAt ? candidate.payment.paidAt.toISOString() : "",
            refundedAt: candidate.payment.refundedAt ? candidate.payment.refundedAt.toISOString() : "",
          },
          membership: candidate.membership
            ? {
                id: candidate.membership.id,
                status: candidate.membership.status,
                isPaid: candidate.membership.isPaid,
                joinedAt: candidate.membership.joinedAt ? candidate.membership.joinedAt.toISOString() : "",
                expireAt: candidate.membership.expireAt ? candidate.membership.expireAt.toISOString() : "",
                sourceOrderId: candidate.membership.sourceOrderId || "",
              }
            : null,
        },
      },
      null,
      2
    )
  );
}

async function applyRestore(user, candidate) {
  const order = candidate.order;
  const payment = candidate.payment;
  const group = candidate.order.group;

  if (!group) {
    throw new Error("目标星球不存在");
  }

  const paidAt = payment.paidAt || order.paidAt || new Date();
  const expireAt = buildExpireAt(group, paidAt);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const existingMembership = candidate.membership;

    if (existingMembership) {
      await tx.groupMember.update({
        where: {
          id: existingMembership.id,
        },
        data: {
          status: "ACTIVE",
          isPaid: true,
          expireAt,
          lastActiveAt: now,
          sourceOrderId: order.id,
        },
      });
    } else {
      const memberNo = (await tx.groupMember.count({ where: { groupId: group.id } })) + 1;
      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId: user.id,
          memberNo,
          status: "ACTIVE",
          joinSource: order.promotionChannelId ? "QR_CODE" : "DIRECT",
          isPaid: true,
          joinedAt: paidAt,
          firstJoinedAt: paidAt,
          expireAt,
          lastActiveAt: now,
          sourceOrderId: order.id,
          phone: user.mobile || null,
        },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentStatus: "PAID",
        netAmount: order.amount,
        paidAt,
      },
    });

    await tx.paymentRecord.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        paidAt,
        refundedAt: null,
        rawPayload: sanitizeRefundPayload(payment.rawPayload),
      },
    });

    await tx.groupNotificationSubscription.upsert({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId: user.id,
        },
      },
      create: {
        groupId: group.id,
        userId: user.id,
        enabled: true,
        lastSubscribedAt: now,
      },
      update: {
        enabled: true,
        lastSubscribedAt: now,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "PAID",
        reason: "refund_restore_membership",
        payload: {
          userId: user.id,
          groupId: group.id,
          paymentRecordId: payment.id,
        },
      },
    });

    await syncActiveMemberAggregates(tx, group.id);
  });

  const restored = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: group.id,
        userId: user.id,
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        applied: true,
        result: {
          userId: user.id,
          mobile: user.mobile || "",
          groupId: group.id,
          groupName: group.name,
          orderNo: order.orderNo,
          membershipStatus: restored ? restored.status : "",
          expireAt: restored && restored.expireAt ? restored.expireAt.toISOString() : "",
        },
      },
      null,
      2
    )
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const user = await resolveUser(args);
  const candidate = await resolveCandidate(args, user);

  printPreview(user, candidate);

  if (!args.apply) {
    console.log("\nPreview only. Add --apply to write changes.");
    return;
  }

  await applyRestore(user, candidate);
}

main()
  .catch(async (error) => {
    console.error(error && error.message ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
