const { prisma } = require("../db/prisma");

const ORDER_EXPIRY_MINUTES = 15;

function toMoneyNumber(value) {
  return Number(value);
}

function nowPlusMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function nowPlusDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function membershipIsActive(membership) {
  if (!membership) return false;
  if (membership.status !== "ACTIVE") return false;
  if (!membership.expireAt) return true;
  return new Date(membership.expireAt).getTime() > Date.now();
}

async function findPreviewDependencies(groupId, userId, couponCode, channelCode) {
  const [user, group, policy, coupon, channel, membership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    }),
    prisma.group.findUnique({
      where: { id: groupId },
    }),
    prisma.groupPermissionPolicy.findUnique({
      where: { groupId },
    }),
    couponCode
      ? prisma.coupon.findUnique({
          where: { code: couponCode },
        })
      : Promise.resolve(null),
    channelCode
      ? prisma.promotionChannel.findUnique({
          where: { code: channelCode },
        })
      : Promise.resolve(null),
    prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    }),
  ]);

  const matchedCoupon = coupon && coupon.groupId === groupId ? coupon : null;
  const matchedChannel = channel && channel.groupId === groupId ? channel : null;

  return { user, group, policy, coupon: matchedCoupon, channel: matchedChannel, membership };
}

async function buildPreview(groupId, userId, couponCode, channelCode) {
  const { user, group, policy, coupon, channel, membership } =
    await findPreviewDependencies(groupId, userId, couponCode, channelCode);

  if (!user || !user.profile) {
    return { statusCode: 404, payload: { ok: false, message: "用户不存在" } };
  }

  if (!group || !policy) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在或未配置策略" } };
  }

  const baseAmount = toMoneyNumber(group.priceAmount);
  const discountAmount = coupon ? toMoneyNumber(coupon.amount) : 0;
  const originalAmount = toMoneyNumber(group.originalPriceAmount);
  const payableAmount = Math.max(baseAmount - discountAmount, 0);
  const durationDays =
    group.billingPeriod === "YEAR"
      ? 365
      : group.billingPeriod === "QUARTER"
        ? 90
        : group.billingPeriod === "MONTH"
          ? 30
          : 3650;

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        user: {
          id: user.id,
          nickname: user.profile.nickname,
        },
        group: {
          id: group.id,
          name: group.name,
          intro: group.intro || "",
          joinType: group.joinType,
          status: group.status,
        },
        policy: {
          allowJoin: policy.allowJoin,
          needExamine: policy.needExamine,
          allowPreview: policy.allowPreview,
          allowSearch: policy.allowSearch,
        },
        pricing: {
          planId: group.id,
          billingPeriod: group.billingPeriod,
          durationDays,
          originalAmount: Math.round(originalAmount * 100),
          payableAmount: Math.round(payableAmount * 100),
        },
        coupon: coupon
          ? {
              id: coupon.id,
              code: coupon.code,
              name: coupon.name,
              discountAmount: Math.round(toMoneyNumber(coupon.amount) * 100),
            }
          : null,
        channel: channel
          ? {
              id: channel.id,
              code: channel.code,
              name: channel.name,
            }
          : null,
        membership: membership
          ? {
              id: membership.id,
              status: membership.status,
              expireAt: membership.expireAt,
              isActive: membershipIsActive(membership),
            }
          : null,
      },
    },
  };
}

async function createJoinOrder(input) {
  const { groupId, userId, couponCode, channelCode, paymentChannel } = input;
  const { user, group, policy, coupon, channel, membership } =
    await findPreviewDependencies(groupId, userId, couponCode, channelCode);

  if (!user) {
    return { statusCode: 404, payload: { ok: false, message: "用户不存在" } };
  }

  if (!group || !policy) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在或未配置策略" } };
  }

  if (!policy.allowJoin || group.status !== "ACTIVE") {
    return { statusCode: 400, payload: { ok: false, message: "当前星球不可加入" } };
  }

  if (membershipIsActive(membership)) {
    return { statusCode: 409, payload: { ok: false, message: "用户已是有效成员，请走续费流程" } };
  }

  if (couponCode && !coupon) {
    return { statusCode: 400, payload: { ok: false, message: "优惠券不可用" } };
  }

  if (channelCode && !channel) {
    return { statusCode: 400, payload: { ok: false, message: "渠道不可用" } };
  }

  const baseAmount = toMoneyNumber(group.priceAmount);
  const originalAmount = toMoneyNumber(group.originalPriceAmount);
  const discountAmount = coupon ? toMoneyNumber(coupon.amount) : 0;
  const payableAmount = Math.max(baseAmount - discountAmount, 0);
  const orderNo = `JOIN${Date.now()}`;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNo,
        groupId,
        userId,
        type: "GROUP_JOIN",
        status: "PENDING",
        paymentStatus: "UNPAID",
        amount: payableAmount,
        netAmount: 0,
        originalAmount,
        discountAmount,
        couponId: coupon ? coupon.id : null,
        promotionChannelId: channel ? channel.id : null,
        expireAt: nowPlusMinutes(ORDER_EXPIRY_MINUTES),
      },
    });

    const payment = await tx.paymentRecord.create({
      data: {
        orderId: order.id,
        channel: paymentChannel || "WECHAT",
        status: "UNPAID",
        amount: payableAmount,
        rawPayload: {
          channel: paymentChannel || "WECHAT",
          stage: "order_created",
        },
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        toStatus: "PENDING",
        reason: "create_join_order",
        payload: {
          couponId: coupon ? coupon.id : null,
          promotionChannelId: channel ? channel.id : null,
        },
      },
    });

    if (coupon) {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: {
          visitCount: {
            increment: 1,
          },
        },
      });
    }

    await tx.analyticsEvent.create({
      data: {
        groupId,
        userId,
        eventType: "PREVIEW_CLICK_JOIN",
        targetType: "GROUP",
        targetId: groupId,
        promotionChannelId: channel ? channel.id : null,
        eventDedupKey: `${orderNo}:preview_click_join`,
        properties: {
          orderNo,
          couponCode: couponCode || null,
          paymentChannel: paymentChannel || "WECHAT",
        },
      },
    });

    return { order, payment };
  });

  return {
    statusCode: 201,
    payload: {
      ok: true,
      data: {
        order: {
          id: result.order.id,
          orderNo: result.order.orderNo,
          status: result.order.status,
          amount: Math.round(toMoneyNumber(result.order.amount) * 100),
          discountAmount: Math.round(toMoneyNumber(result.order.discountAmount) * 100),
          createdAt: result.order.createdAt,
        },
        payment: {
          id: result.payment.id,
          channel: result.payment.channel,
          status: result.payment.status,
        },
      },
    },
  };
}

async function applyPaymentSuccess(input) {
  const { orderNo, transactionNo, success = true } = input;

  const order = await prisma.order.findUnique({
    where: { orderNo },
  });

  if (!order) {
    return { statusCode: 404, payload: { ok: false, message: "订单不存在" } };
  }

  const payment = await prisma.paymentRecord.findFirst({
    where: { orderId: order.id },
  });

  if (!payment) {
    return { statusCode: 404, payload: { ok: false, message: "支付记录不存在" } };
  }

  if (payment.transactionNo === transactionNo && payment.status === "PAID") {
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: order.groupId,
          userId: order.userId,
        },
      },
    });

    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          order: {
            orderNo: order.orderNo,
            status: order.status,
            paidAt: order.paidAt,
          },
          payment: {
            status: payment.status,
            transactionNo: payment.transactionNo,
          },
          membership: membership
            ? {
                status: membership.status,
                expireAt: membership.expireAt,
              }
            : null,
          idempotent: true,
        },
      },
    };
  }

  const group = await prisma.group.findUnique({
    where: { id: order.groupId },
  });

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  const durationDays =
    group.billingPeriod === "YEAR"
      ? 365
      : group.billingPeriod === "QUARTER"
        ? 90
        : group.billingPeriod === "MONTH"
          ? 30
          : 3650;

  const result = await prisma.$transaction(async (tx) => {
    if (!success) {
      const failedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: "FAILED",
          paymentStatus: "FAILED",
        },
      });

      const failedPayment = await tx.paymentRecord.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          transactionNo: transactionNo || payment.transactionNo,
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: "FAILED",
          reason: "payment_failed",
          payload: { transactionNo: transactionNo || null },
        },
      });

      return { order: failedOrder, payment: failedPayment, membership: null, idempotent: false };
    }

    const paidOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentStatus: "PAID",
        netAmount: order.amount,
        paidAt: new Date(),
      },
    });

    const paidPayment = await tx.paymentRecord.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        transactionNo,
        paidAt: new Date(),
        rawPayload: {
          ...(payment.rawPayload || {}),
          stage: "paid",
          transactionNo,
        },
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "PAID",
        reason: "payment_succeeded",
        payload: { transactionNo },
      },
    });

    const existingMembership = await tx.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: order.groupId,
          userId: order.userId,
        },
      },
    });

    const activeMemberCount = await tx.groupMember.count({
      where: { groupId: order.groupId },
    });

    const membership = existingMembership
      ? await tx.groupMember.update({
          where: { id: existingMembership.id },
          data: {
            status: "ACTIVE",
            isPaid: true,
            expireAt: nowPlusDays(durationDays),
            lastActiveAt: new Date(),
            sourceOrderId: order.id,
          },
        })
      : await tx.groupMember.create({
          data: {
            groupId: order.groupId,
            userId: order.userId,
            memberNo: activeMemberCount + 1,
            status: "ACTIVE",
            joinSource: order.promotionChannelId ? "QR_CODE" : "DIRECT",
            isPaid: true,
            joinedAt: new Date(),
            firstJoinedAt: new Date(),
            expireAt: nowPlusDays(durationDays),
            lastActiveAt: new Date(),
            sourceOrderId: order.id,
          },
        });

    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: {
          usedQuantity: {
            increment: 1,
          },
        },
      });

      await tx.couponClaim.create({
        data: {
          couponId: order.couponId,
          memberId: membership.id,
          orderId: order.id,
          claimedAt: order.createdAt,
          usedAt: new Date(),
        },
      });
    }

    await tx.group.update({
      where: { id: order.groupId },
      data: {
        memberCount: await tx.groupMember.count({ where: { groupId: order.groupId } }),
        paidMemberCount: await tx.groupMember.count({
          where: {
            groupId: order.groupId,
            isPaid: true,
            status: "ACTIVE",
          },
        }),
      },
    });

    await tx.analyticsEvent.create({
      data: {
        groupId: order.groupId,
        userId: order.userId,
        eventType: "JOIN_PAID",
        targetType: "ORDER",
        targetId: order.id,
        promotionChannelId: order.promotionChannelId,
        eventDedupKey: `${order.orderNo}:join_paid`,
        properties: {
          orderNo: order.orderNo,
          paidAmount: Math.round(toMoneyNumber(order.amount) * 100),
          transactionNo,
        },
      },
    });

    await tx.outboxJob.createMany({
      data: [
        {
          topic: "membership.activated",
          aggregateType: "order",
          aggregateId: order.id,
          payload: {
            groupId: order.groupId,
            userId: order.userId,
          },
        },
        {
          topic: "analytics.refresh",
          aggregateType: "group",
          aggregateId: order.groupId,
          payload: {
            source: "join_paid",
            orderId: order.id,
          },
        },
      ],
    });

    return { order: paidOrder, payment: paidPayment, membership, idempotent: false };
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        order: {
          orderNo: result.order.orderNo,
          status: result.order.status,
          paidAt: result.order.paidAt,
        },
        payment: {
          status: result.payment.status,
          transactionNo: result.payment.transactionNo,
        },
        membership: result.membership
          ? {
              status: result.membership.status,
              expireAt: result.membership.expireAt,
            }
          : null,
        idempotent: result.idempotent,
      },
    },
  };
}

async function getMembershipStatus(groupId, userId) {
  const membership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId,
      },
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: membership
        ? {
            status: membership.status,
            expireAt: membership.expireAt,
            isActive: membershipIsActive(membership),
          }
        : null,
    },
  };
}

async function getOrder(orderNo) {
  const order = await prisma.order.findUnique({
    where: { orderNo },
  });
  if (!order) {
    return { statusCode: 404, payload: { ok: false, message: "订单不存在" } };
  }

  const [payment, membership] = await Promise.all([
    prisma.paymentRecord.findFirst({ where: { orderId: order.id } }),
    prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: order.groupId,
          userId: order.userId,
        },
      },
    }),
  ]);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        order: {
          id: order.id,
          orderNo: order.orderNo,
          status: order.status,
          paymentStatus: order.paymentStatus,
          amount: Math.round(toMoneyNumber(order.amount) * 100),
          paidAt: order.paidAt,
        },
        payment: payment
          ? {
              id: payment.id,
              status: payment.status,
              transactionNo: payment.transactionNo,
            }
          : null,
        membership: membership
          ? {
              id: membership.id,
              status: membership.status,
              expireAt: membership.expireAt,
            }
          : null,
      },
    },
  };
}

async function getDebugState() {
  const [groups, members, orders, payments, coupons, events] = await Promise.all([
    prisma.group.findMany(),
    prisma.groupMember.findMany(),
    prisma.order.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.paymentRecord.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.coupon.findMany(),
    prisma.analyticsEvent.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        groups,
        members,
        orders,
        payments,
        coupons,
        events,
      },
    },
  };
}

module.exports = {
  buildPreview,
  createJoinOrder,
  applyPaymentSuccess,
  getMembershipStatus,
  getOrder,
  getDebugState,
};
