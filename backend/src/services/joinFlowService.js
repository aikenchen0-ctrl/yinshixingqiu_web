const { prisma } = require("../db/prisma");
const { getPaywallHighlightSnapshot } = require("./paywallHighlightStore");
const { getRenewalSettingColumnNames } = require("./renewalSettingSchemaService");
const { createJsapiPayment, queryJsapiPaymentOrderByOutTradeNo } = require("./wechatPayService");
const { applyArticleUnlockPaymentSuccess } = require("./articleUnlockService");

const ORDER_EXPIRY_MINUTES = 15;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const RENEWAL_ENTRY_DAYS = 30;
const RENEWAL_SETTING_COLUMN_DEFINITIONS = [
  { key: "enabled", column: "enabled" },
  { key: "limitWindow", column: "limit_window" },
  { key: "amount", column: "amount" },
  { key: "originalAmount", column: "original_amount" },
  { key: "discountedPercentage", column: "discounted_percentage" },
  { key: "expiringEnabled", column: "expiring_enabled" },
  { key: "advanceAmount", column: "advance_amount" },
  { key: "advanceDiscountPercentage", column: "advance_discount_percentage" },
  { key: "advanceEnabled", column: "advance_enabled" },
  { key: "graceAmount", column: "grace_amount" },
  { key: "graceDiscountPercentage", column: "grace_discount_percentage" },
  { key: "graceEnabled", column: "grace_enabled" },
  { key: "beginTime", column: "begin_time" },
  { key: "endTime", column: "end_time" },
  { key: "guidance", column: "guidance" },
  { key: "renewalUrl", column: "renewal_url" },
];

function toMoneyNumber(value) {
  return Number(value);
}

function buildDiscountPercent(amount, originalAmount) {
  const normalizedOriginalAmount = toMoneyNumber(originalAmount);
  if (!Number.isFinite(normalizedOriginalAmount) || normalizedOriginalAmount <= 0) {
    return 100;
  }

  return Math.round((toMoneyNumber(amount) / normalizedOriginalAmount) * 100);
}

function nowPlusMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function nowPlusDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function toIso(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getDateValue(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function resolveOrderUserId(sessionToken, inputUserId) {
  const normalizedSessionToken = String(sessionToken || "").trim();
  const normalizedUserId = String(inputUserId || "").trim();

  if (!normalizedSessionToken) {
    if (!normalizedUserId) {
      return { ok: false, statusCode: 400, message: "缺少用户 ID" };
    }

    return {
      ok: true,
      userId: normalizedUserId,
    };
  }

  const session = await prisma.authSession.findUnique({
    where: {
      sessionToken: normalizedSessionToken,
    },
  });

  if (!session || session.status !== "ACTIVE") {
    return { ok: false, statusCode: 401, message: "登录态无效" };
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.authSession.update({
      where: {
        id: session.id,
      },
      data: {
        status: "EXPIRED",
      },
    });

    return { ok: false, statusCode: 401, message: "登录态已过期" };
  }

  if (normalizedUserId && normalizedUserId !== session.userId) {
    return { ok: false, statusCode: 403, message: "不允许代其他用户发起支付" };
  }

  return {
    ok: true,
    userId: session.userId,
  };
}

function serializeOrderSummary(order) {
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    amount: Math.round(toMoneyNumber(order.amount) * 100),
    discountAmount: Math.round(toMoneyNumber(order.discountAmount) * 100),
    createdAt: order.createdAt,
  };
}

function serializePaymentSummary(payment, options = {}) {
  const requiresPayment =
    typeof options.required === "boolean"
      ? options.required
      : Math.round(toMoneyNumber(payment.amount) * 100) > 0 && payment.status !== "PAID";

  return {
    id: payment.id,
    channel: payment.channel,
    status: payment.status,
    required: requiresPayment,
    request: options.request || null,
  };
}

async function createWechatPaymentRequest(input = {}) {
  const { order, payment, user, group } = input;

  if (!payment || payment.channel !== "WECHAT") {
    return {
      payment,
      request: null,
    };
  }

  if (Math.round(toMoneyNumber(order.amount) * 100) <= 0) {
    return {
      payment,
      request: null,
    };
  }

  try {
    const wechatPayment = await createJsapiPayment({
      order,
      user,
      group,
    });

    const updatedPayment = await prisma.paymentRecord.update({
      where: {
        id: payment.id,
      },
      data: {
        rawPayload: {
          ...(payment.rawPayload || {}),
          stage: "prepay_created",
          prepayId: wechatPayment.prepayId,
          prepayCreatedAt: new Date().toISOString(),
        },
      },
    });

    return {
      payment: updatedPayment,
      request: wechatPayment.request,
    };
  } catch (error) {
    try {
      await prisma.paymentRecord.update({
        where: {
          id: payment.id,
        },
        data: {
          rawPayload: {
            ...(payment.rawPayload || {}),
            stage: "prepay_failed",
            prepayFailedAt: new Date().toISOString(),
            prepayErrorMessage: error && error.message ? error.message : "未知错误",
          },
        },
      });
    } catch (updateError) {
      // ignore nested persistence errors so the original pay error can be surfaced
    }

    throw error;
  }
}

function membershipIsActive(membership) {
  if (!membership) return false;
  if (membership.status !== "ACTIVE") return false;
  if (!membership.expireAt) return true;
  return new Date(membership.expireAt).getTime() > Date.now();
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

function resolveJoinCoupon(coupon, groupId) {
  if (!coupon || coupon.groupId !== groupId) {
    return { coupon: null, message: "优惠券不可用" };
  }

  if (coupon.type !== "PROMOTION") {
    return { coupon: null, message: "当前优惠券不支持加入星球" };
  }

  if (coupon.status !== "ACTIVE") {
    return { coupon: null, message: "优惠券未生效" };
  }

  if (coupon.validFrom && new Date(coupon.validFrom).getTime() > Date.now()) {
    return { coupon: null, message: "优惠券尚未到生效时间" };
  }

  if (coupon.validTo && new Date(coupon.validTo).getTime() < Date.now()) {
    return { coupon: null, message: "优惠券已过期" };
  }

  if (coupon.totalQuantity !== null && coupon.totalQuantity !== undefined && coupon.usedQuantity >= coupon.totalQuantity) {
    return { coupon: null, message: "优惠券已领完" };
  }

  return { coupon, message: "" };
}

function resolveRenewalCoupon(coupon, groupId) {
  if (!coupon || coupon.groupId !== groupId) {
    return { coupon: null, message: "优惠券不可用" };
  }

  if (coupon.type !== "RENEWAL") {
    return { coupon: null, message: "当前优惠券不支持续期" };
  }

  if (coupon.status !== "ACTIVE") {
    return { coupon: null, message: "优惠券未生效" };
  }

  if (coupon.validFrom && new Date(coupon.validFrom).getTime() > Date.now()) {
    return { coupon: null, message: "优惠券尚未到生效时间" };
  }

  if (coupon.validTo && new Date(coupon.validTo).getTime() < Date.now()) {
    return { coupon: null, message: "优惠券已过期" };
  }

  if (coupon.totalQuantity !== null && coupon.totalQuantity !== undefined && coupon.usedQuantity >= coupon.totalQuantity) {
    return { coupon: null, message: "优惠券已领完" };
  }

  return { coupon, message: "" };
}

function getCouponDiscountAmount(coupon, baseAmount) {
  if (!coupon) {
    return 0;
  }

  return Math.min(Math.max(toMoneyNumber(coupon.amount), 0), Math.max(toMoneyNumber(baseAmount), 0));
}

function buildRenewalPricingSnapshot(renewal, coupon) {
  const renewalAmount = Math.max(toMoneyNumber(renewal && renewal.amount), 0);
  const originalAmount = Math.max(toMoneyNumber(renewal && renewal.originalAmount), renewalAmount);
  const couponDiscountAmount = getCouponDiscountAmount(coupon, renewalAmount);
  const payableAmount = Math.max(renewalAmount - couponDiscountAmount, 0);
  const totalDiscountAmount = Math.max(originalAmount - payableAmount, 0);

  return {
    originalAmount,
    renewalAmount,
    couponDiscountAmount,
    payableAmount,
    totalDiscountAmount,
  };
}

function serializeJoinCoupon(coupon) {
  const amount = Math.round(toMoneyNumber(coupon.amount) * 100);
  const totalQuantity =
    coupon.totalQuantity === null || coupon.totalQuantity === undefined ? null : Number(coupon.totalQuantity);
  const remainingQuantity = totalQuantity === null ? null : Math.max(totalQuantity - Number(coupon.usedQuantity || 0), 0);

  return {
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    amount,
    amountText: `¥${(amount / 100).toFixed(amount % 100 === 0 ? 0 : 2)}`,
    totalQuantity,
    usedQuantity: Number(coupon.usedQuantity || 0),
    remainingQuantity,
    validFrom: toIso(coupon.validFrom),
    validTo: toIso(coupon.validTo),
    status: coupon.status,
  };
}

function serializeJoinChannel(channel) {
  return {
    id: channel.id,
    code: channel.code,
    name: channel.name,
    qrCodeUrl: channel.qrCodeUrl || "",
  };
}

async function findCompatibleRenewalSetting(groupId) {
  if (!groupId) {
    return null;
  }

  const columnNames = await getRenewalSettingColumnNames();
  if (!columnNames.size || !columnNames.has("group_id")) {
    return null;
  }

  const selectedColumns = RENEWAL_SETTING_COLUMN_DEFINITIONS.filter((item) => columnNames.has(item.column));
  if (!selectedColumns.length) {
    return null;
  }

  const selectClause = selectedColumns.map((item) => `"${item.column}"`).join(", ");

  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT ${selectClause} FROM "renewal_settings" WHERE "group_id" = $1 LIMIT 1`,
      groupId
    );
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row) {
      return null;
    }

    return selectedColumns.reduce((result, item) => {
      result[item.key] = row[item.column];
      return result;
    }, {});
  } catch (error) {
    return null;
  }
}

function resolveRenewalStage(daysUntilExpire, isExpired) {
  if (isExpired) {
    return "grace";
  }

  if (typeof daysUntilExpire !== "number" || daysUntilExpire > RENEWAL_ENTRY_DAYS) {
    return "";
  }

  return daysUntilExpire > 7 ? "advance" : "expiring";
}

function isRenewalWindowOpen(setting, now) {
  if (!setting || setting.limitWindow !== true) {
    return true;
  }

  const beginTime = getDateValue(setting.beginTime);
  const endTime = getDateValue(setting.endTime);

  if (beginTime && now.getTime() < beginTime.getTime()) {
    return false;
  }

  if (endTime && now.getTime() > endTime.getTime()) {
    return false;
  }

  return true;
}

function buildRenewalSnapshot(input = {}) {
  const { group, membership, isOwner = false, setting = null, now = new Date() } = input;
  const expireAtDate = getDateValue(membership && membership.expireAt);
  const expireAtTime = expireAtDate ? expireAtDate.getTime() : 0;
  const diffMs = expireAtDate ? expireAtTime - now.getTime() : null;
  const isExpired = typeof diffMs === "number" ? diffMs <= 0 : false;
  const daysUntilExpire =
    typeof diffMs === "number"
      ? diffMs > 0
        ? Math.ceil(diffMs / DAY_IN_MS)
        : Math.floor(diffMs / DAY_IN_MS)
      : null;
  const isExpiringSoon = typeof diffMs === "number" ? diffMs > 0 && diffMs <= RENEWAL_ENTRY_DAYS * DAY_IN_MS : false;
  const stage = resolveRenewalStage(daysUntilExpire, isExpired);
  const membershipStatus = String(membership && membership.status ? membership.status : "").toUpperCase();
  const canRenewByStatus = membershipStatus === "ACTIVE" || membershipStatus === "EXPIRED";
  const overallEnabled = setting ? setting.enabled !== false : true;
  const windowOpen = isRenewalWindowOpen(setting, now);
  const stageEnabled =
    stage === "grace"
      ? setting
        ? setting.graceEnabled !== false
        : true
      : stage === "advance"
        ? setting
          ? setting.advanceEnabled !== false
          : true
        : stage === "expiring"
          ? setting
            ? setting.expiringEnabled !== false
            : true
          : false;

  const groupPriceAmount = Math.max(toMoneyNumber(group && group.priceAmount), 0);
  const groupOriginalAmount = Math.max(toMoneyNumber(group && group.originalPriceAmount), groupPriceAmount);
  const defaultAmount = setting ? Math.max(toMoneyNumber(setting.amount), 0) || groupPriceAmount : groupPriceAmount;
  const originalAmount = setting
    ? Math.max(toMoneyNumber(setting.originalAmount), 0) || groupOriginalAmount
    : groupOriginalAmount;
  const amount =
    stage === "grace"
      ? setting
        ? Math.max(toMoneyNumber(setting.graceAmount), 0) || defaultAmount
        : defaultAmount
      : stage === "advance"
        ? setting
          ? Math.max(toMoneyNumber(setting.advanceAmount), 0) || defaultAmount
          : defaultAmount
        : defaultAmount;
  const discountedPercentage =
    stage === "grace"
      ? setting && Number.isFinite(Number(setting.graceDiscountPercentage))
        ? Number(setting.graceDiscountPercentage)
        : buildDiscountPercent(amount, originalAmount)
      : stage === "advance"
        ? setting && Number.isFinite(Number(setting.advanceDiscountPercentage))
          ? Number(setting.advanceDiscountPercentage)
          : buildDiscountPercent(amount, originalAmount)
        : setting && Number.isFinite(Number(setting.discountedPercentage))
          ? Number(setting.discountedPercentage)
          : buildDiscountPercent(amount, originalAmount);
  const canRenew = Boolean(
    overallEnabled &&
      windowOpen &&
      !isOwner &&
      group &&
      group.joinType !== "FREE" &&
      membership &&
      membership.isPaid &&
      expireAtDate &&
      canRenewByStatus &&
      (isExpired || isExpiringSoon) &&
      stageEnabled
  );

  return {
    enabled: overallEnabled && windowOpen,
    canRenew,
    stage,
    isExpired,
    isExpiringSoon,
    daysUntilExpire,
    expireAt: expireAtDate ? expireAtDate.toISOString() : null,
    amount,
    originalAmount,
    discountedPercentage,
  };
}

function parsePaymentReviewInfo(payment) {
  const rawPayload =
    payment && payment.rawPayload && typeof payment.rawPayload === "object" && !Array.isArray(payment.rawPayload)
      ? { ...payment.rawPayload }
      : {};
  const reviewStatus = String(rawPayload.reviewStatus || "").trim().toUpperCase();

  return {
    rawPayload,
    reviewRequired: Boolean(rawPayload.reviewRequired),
    reviewStatus: ["PENDING", "REJECTED", "APPROVED"].includes(reviewStatus) ? reviewStatus : "",
    reviewReason: String(rawPayload.reviewReason || "").trim(),
    reviewSubmittedAt: rawPayload.reviewSubmittedAt || null,
    reviewedAt: rawPayload.reviewedAt || null,
    reviewerUserId: rawPayload.reviewerUserId || null,
  };
}

function buildReviewMembershipPayload(reviewApplication) {
  if (!reviewApplication) {
    return null;
  }

  return {
    status: reviewApplication.reviewStatus || "PENDING",
    expireAt: null,
    isActive: false,
    orderNo: reviewApplication.order.orderNo,
    appliedAt: reviewApplication.order.paidAt || reviewApplication.order.createdAt || null,
    reviewReason: reviewApplication.reviewReason || "",
    reviewedAt: reviewApplication.reviewedAt || null,
  };
}

async function findLatestJoinReviewApplication(groupId, userId, client = prisma) {
  if (!groupId || !userId) {
    return null;
  }

  const orders = await client.order.findMany({
    where: {
      groupId,
      userId,
      type: "GROUP_JOIN",
      paymentStatus: "PAID",
    },
    include: {
      paymentRecords: {
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: 12,
  });

  for (const order of orders) {
    const payment = order.paymentRecords && order.paymentRecords.length ? order.paymentRecords[0] : null;
    if (!payment) {
      continue;
    }

    const reviewInfo = parsePaymentReviewInfo(payment);
    if (!reviewInfo.reviewRequired && !reviewInfo.reviewStatus) {
      continue;
    }

    return {
      order,
      payment,
      reviewRequired: reviewInfo.reviewRequired,
      reviewStatus: reviewInfo.reviewStatus || "PENDING",
      reviewReason: reviewInfo.reviewReason,
      reviewSubmittedAt: reviewInfo.reviewSubmittedAt,
      reviewedAt: reviewInfo.reviewedAt,
      reviewerUserId: reviewInfo.reviewerUserId,
    };
  }

  return null;
}

async function listGroupJoinReviewApplications(groupId, client = prisma) {
  if (!groupId) {
    return [];
  }

  const orders = await client.order.findMany({
    where: {
      groupId,
      type: "GROUP_JOIN",
      paymentStatus: "PAID",
    },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
      paymentRecords: {
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
      promotionChannel: true,
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });

  const latestApplicationByUser = new Map();

  for (const order of orders) {
    if (latestApplicationByUser.has(order.userId)) {
      continue;
    }

    const payment = order.paymentRecords && order.paymentRecords.length ? order.paymentRecords[0] : null;
    if (!payment) {
      continue;
    }

    const reviewInfo = parsePaymentReviewInfo(payment);
    if (!reviewInfo.reviewRequired && !reviewInfo.reviewStatus) {
      continue;
    }

    latestApplicationByUser.set(order.userId, {
      order,
      payment,
      reviewRequired: reviewInfo.reviewRequired,
      reviewStatus: reviewInfo.reviewStatus || "PENDING",
      reviewReason: reviewInfo.reviewReason,
      reviewSubmittedAt: reviewInfo.reviewSubmittedAt,
      reviewedAt: reviewInfo.reviewedAt,
      reviewerUserId: reviewInfo.reviewerUserId,
    });
  }

  return Array.from(latestApplicationByUser.values()).filter(
    (item) => item.reviewStatus === "PENDING" || item.reviewStatus === "REJECTED"
  );
}

async function resolveMembershipPayload(groupId, userId, membership, client = prisma) {
  if (membershipIsActive(membership)) {
    return {
      id: membership.id,
      status: membership.status,
      expireAt: membership.expireAt,
      isActive: true,
      joinedAt: membership.joinedAt || null,
      isPaid: Boolean(membership.isPaid),
      orderNo: null,
      appliedAt: null,
      reviewReason: "",
      reviewedAt: null,
    };
  }

  const reviewApplication = await findLatestJoinReviewApplication(groupId, userId, client);
  if (reviewApplication && (reviewApplication.reviewStatus === "PENDING" || reviewApplication.reviewStatus === "REJECTED")) {
    return buildReviewMembershipPayload(reviewApplication);
  }

  if (!membership) {
    return null;
  }

  return {
    id: membership.id,
    status: membership.status,
    expireAt: membership.expireAt,
    isActive: false,
    joinedAt: membership.joinedAt || null,
    isPaid: Boolean(membership.isPaid),
    orderNo: null,
    appliedAt: null,
    reviewReason: "",
    reviewedAt: null,
  };
}

async function updateGroupMemberAggregates(tx, groupId) {
  await tx.group.update({
    where: { id: groupId },
    data: {
      memberCount: await tx.groupMember.count({ where: { groupId } }),
      paidMemberCount: await tx.groupMember.count({
        where: {
          groupId,
          isPaid: true,
          status: "ACTIVE",
        },
      }),
    },
  });
}

async function activateJoinMembership(tx, order, group) {
  const durationDays = getDurationDays(group);
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

  await consumeOrderCouponClaim(tx, order, membership.id);

  await updateGroupMemberAggregates(tx, order.groupId);

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

  return membership;
}

async function consumeOrderCouponClaim(tx, order, memberId) {
  if (!order || !order.couponId || !memberId) {
    return;
  }

  const existingClaim = await tx.couponClaim.findFirst({
    where: {
      couponId: order.couponId,
      orderId: order.id,
    },
  });

  if (existingClaim) {
    return;
  }

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
      memberId,
      orderId: order.id,
      claimedAt: order.createdAt,
      usedAt: new Date(),
    },
  });
}

async function activateRenewalMembership(tx, order, group) {
  const durationDays = getDurationDays(group);
  const existingMembership = await tx.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: order.groupId,
        userId: order.userId,
      },
    },
  });

  if (!existingMembership) {
    throw new Error("续期成员不存在");
  }

  const now = new Date();
  const currentExpireAt = getDateValue(existingMembership.expireAt);
  const baseTime =
    currentExpireAt && currentExpireAt.getTime() > now.getTime() ? currentExpireAt.getTime() : now.getTime();
  const nextExpireAt = new Date(baseTime + durationDays * DAY_IN_MS);

  const membership = await tx.groupMember.update({
    where: { id: existingMembership.id },
    data: {
      status: "ACTIVE",
      isPaid: true,
      expireAt: nextExpireAt,
      lastActiveAt: now,
      renewTimes: {
        increment: 1,
      },
      sourceOrderId: order.id,
    },
  });

  await consumeOrderCouponClaim(tx, order, membership.id);
  await updateGroupMemberAggregates(tx, order.groupId);

  await tx.outboxJob.createMany({
    data: [
      {
        topic: "membership.renewed",
        aggregateType: "order",
        aggregateId: order.id,
        payload: {
          groupId: order.groupId,
          userId: order.userId,
          expireAt: nextExpireAt.toISOString(),
        },
      },
      {
        topic: "analytics.refresh",
        aggregateType: "group",
        aggregateId: order.groupId,
        payload: {
          source: "renewal_paid",
          orderId: order.id,
        },
      },
    ],
  });

  return membership;
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

async function findRenewalDependencies(groupId, userId, couponCode) {
  const [user, group, membership, setting, coupon] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
    }),
    prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        joinType: true,
        status: true,
        billingPeriod: true,
        priceAmount: true,
        originalPriceAmount: true,
        ownerUserId: true,
      },
    }),
    prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    }),
    findCompatibleRenewalSetting(groupId),
    couponCode
      ? prisma.coupon.findUnique({
          where: { code: couponCode },
        })
      : Promise.resolve(null),
  ]);

  const matchedCoupon = coupon && coupon.groupId === groupId ? coupon : null;

  return { user, group, membership, setting, coupon: matchedCoupon };
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

  const couponGuard = couponCode ? resolveJoinCoupon(coupon, groupId) : { coupon: null, message: "" };
  if (couponCode && !couponGuard.coupon) {
    return { statusCode: 400, payload: { ok: false, message: couponGuard.message || "优惠券不可用" } };
  }

  const baseAmount = toMoneyNumber(group.priceAmount);
  const activeCoupon = couponGuard.coupon;
  const discountAmount = activeCoupon ? toMoneyNumber(activeCoupon.amount) : 0;
  const originalAmount = toMoneyNumber(group.originalPriceAmount);
  const payableAmount = Math.max(baseAmount - discountAmount, 0);
  const durationDays = getDurationDays(group);
  const membershipPayload = await resolveMembershipPayload(groupId, userId, membership);
  const paywallHighlights = getPaywallHighlightSnapshot(group.id);

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
        coupon: activeCoupon
          ? {
              id: activeCoupon.id,
              code: activeCoupon.code,
              name: activeCoupon.name,
              discountAmount: Math.round(toMoneyNumber(activeCoupon.amount) * 100),
            }
          : null,
        channel: channel
          ? {
              id: channel.id,
              code: channel.code,
              name: channel.name,
            }
          : null,
        paywallHighlights,
        membership: membershipPayload,
      },
    },
  };
}

async function createJoinOrder(input) {
  const { groupId, userId, couponCode, channelCode, paymentChannel, sessionToken } = input;
  const identityResult = await resolveOrderUserId(sessionToken, userId);

  if (!identityResult.ok) {
    return {
      statusCode: identityResult.statusCode,
      payload: {
        ok: false,
        message: identityResult.message,
      },
    };
  }

  const resolvedUserId = identityResult.userId;
  const { user, group, policy, coupon, channel, membership } =
    await findPreviewDependencies(groupId, resolvedUserId, couponCode, channelCode);

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

  if (policy.needExamine) {
    const reviewApplication = await findLatestJoinReviewApplication(groupId, resolvedUserId);
    if (reviewApplication && reviewApplication.reviewStatus === "PENDING") {
      return { statusCode: 409, payload: { ok: false, message: "加入申请正在审核中，请等待管理员处理" } };
    }

    if (reviewApplication && reviewApplication.reviewStatus === "REJECTED") {
      const reviewReason = reviewApplication.reviewReason
        ? `，原因：${reviewApplication.reviewReason}`
        : "";
      return {
        statusCode: 409,
        payload: {
          ok: false,
          message: `加入申请已被驳回${reviewReason}，请联系管理员后再处理`,
        },
      };
    }
  }

  const couponGuard = couponCode ? resolveJoinCoupon(coupon, groupId) : { coupon: null, message: "" };
  if (couponCode && !couponGuard.coupon) {
    return { statusCode: 400, payload: { ok: false, message: couponGuard.message || "优惠券不可用" } };
  }

  if (channelCode && !channel) {
    return { statusCode: 400, payload: { ok: false, message: "渠道不可用" } };
  }

  const baseAmount = toMoneyNumber(group.priceAmount);
  const originalAmount = toMoneyNumber(group.originalPriceAmount);
  const activeCoupon = couponGuard.coupon;
  const discountAmount = activeCoupon ? toMoneyNumber(activeCoupon.amount) : 0;
  const payableAmount = Math.max(baseAmount - discountAmount, 0);
  const orderNo = `JOIN${Date.now()}`;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNo,
        groupId,
        userId: resolvedUserId,
        type: "GROUP_JOIN",
        status: "PENDING",
        paymentStatus: "UNPAID",
        amount: payableAmount,
        netAmount: 0,
        originalAmount,
        discountAmount,
        couponId: activeCoupon ? activeCoupon.id : null,
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
          couponId: activeCoupon ? activeCoupon.id : null,
          promotionChannelId: channel ? channel.id : null,
        },
      },
    });

    if (activeCoupon) {
      await tx.coupon.update({
        where: { id: activeCoupon.id },
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
        userId: resolvedUserId,
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

  if (Math.round(payableAmount * 100) <= 0) {
    const paymentResult = await applyPaymentSuccess({
      orderNo,
      transactionNo: `FREE_${orderNo}`,
      success: true,
    });

    if (paymentResult.statusCode !== 200 || !paymentResult.payload.ok) {
      return paymentResult;
    }

    const orderDetailResult = await getOrder(orderNo, {
      sessionToken,
      userId: resolvedUserId,
    });

    if (orderDetailResult.statusCode !== 200 || !orderDetailResult.payload.ok) {
      return orderDetailResult;
    }

    return {
      statusCode: 201,
      payload: {
        ok: true,
        data: {
          order: serializeOrderSummary({
            ...result.order,
            status: orderDetailResult.payload.data.order.status,
            amount: orderDetailResult.payload.data.order.amount / 100,
          }),
          payment: serializePaymentSummary(
            {
              ...result.payment,
              status: orderDetailResult.payload.data.payment
                ? orderDetailResult.payload.data.payment.status
                : "PAID",
            },
            {
              required: false,
              request: null,
            }
          ),
          membership: orderDetailResult.payload.data.membership,
          idempotent: Boolean(paymentResult.payload.data && paymentResult.payload.data.idempotent),
        },
      },
    };
  }

  let preparedPayment;
  try {
    preparedPayment = await createWechatPaymentRequest({
      order: result.order,
      payment: result.payment,
      user,
      group,
    });
  } catch (error) {
    return {
      statusCode: error && Number.isInteger(error.statusCode) ? error.statusCode : 502,
      payload: {
        ok: false,
        message: error && error.message ? error.message : "微信支付下单失败，请稍后重试",
      },
    };
  }

  return {
    statusCode: 201,
    payload: {
      ok: true,
      data: {
        order: serializeOrderSummary(result.order),
        payment: serializePaymentSummary(preparedPayment.payment || result.payment, {
          request: preparedPayment.request,
        }),
        membership: null,
        idempotent: false,
      },
    },
  };
}

async function createRenewalOrder(input) {
  const { groupId, userId, paymentChannel, couponCode, sessionToken } = input;
  const identityResult = await resolveOrderUserId(sessionToken, userId);

  if (!identityResult.ok) {
    return {
      statusCode: identityResult.statusCode,
      payload: {
        ok: false,
        message: identityResult.message,
      },
    };
  }

  const resolvedUserId = identityResult.userId;
  const { user, group, membership, setting, coupon } = await findRenewalDependencies(
    groupId,
    resolvedUserId,
    couponCode
  );

  if (!user) {
    return { statusCode: 404, payload: { ok: false, message: "用户不存在" } };
  }

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  if (group.status !== "ACTIVE" || group.joinType === "FREE") {
    return { statusCode: 400, payload: { ok: false, message: "当前星球不支持续期" } };
  }

  if (group.ownerUserId === resolvedUserId) {
    return { statusCode: 400, payload: { ok: false, message: "星主为永久成员，无需续期" } };
  }

  if (!membership || !membership.isPaid) {
    return { statusCode: 409, payload: { ok: false, message: "当前不是可续期的付费成员" } };
  }

  const renewal = buildRenewalSnapshot({
    group,
    membership,
    isOwner: false,
    setting,
  });

  if (!renewal.canRenew) {
    return { statusCode: 409, payload: { ok: false, message: "当前不在可续期时间窗口内" } };
  }

  const couponGuard = couponCode ? resolveRenewalCoupon(coupon, groupId) : { coupon: null, message: "" };
  if (couponCode && !couponGuard.coupon) {
    return { statusCode: 400, payload: { ok: false, message: couponGuard.message || "优惠券不可用" } };
  }

  const activeCoupon = couponGuard.coupon || (await findPreferredRenewalCoupon(groupId));
  const pricing = buildRenewalPricingSnapshot(renewal, activeCoupon);
  const amount = pricing.payableAmount;
  const originalAmount = pricing.originalAmount;
  const discountAmount = pricing.totalDiscountAmount;
  const orderNo = `RENEW${Date.now()}`;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNo,
        groupId,
        userId: resolvedUserId,
        type: "GROUP_RENEWAL",
        status: "PENDING",
        paymentStatus: "UNPAID",
        amount,
        netAmount: 0,
        originalAmount,
        discountAmount,
        couponId: activeCoupon ? activeCoupon.id : null,
        expireAt: nowPlusMinutes(ORDER_EXPIRY_MINUTES),
      },
    });

    const payment = await tx.paymentRecord.create({
      data: {
        orderId: order.id,
        channel: paymentChannel || "WECHAT",
        status: "UNPAID",
        amount,
        rawPayload: {
          channel: paymentChannel || "WECHAT",
          stage: "order_created",
          renewalStage: renewal.stage,
          couponCode: activeCoupon ? activeCoupon.code : null,
          couponDiscountAmount: Math.round(pricing.couponDiscountAmount * 100),
        },
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        toStatus: "PENDING",
        reason: "create_renewal_order",
        payload: {
          renewalStage: renewal.stage,
          couponId: activeCoupon ? activeCoupon.id : null,
        },
      },
    });

    if (activeCoupon) {
      await tx.coupon.update({
        where: { id: activeCoupon.id },
        data: {
          visitCount: {
            increment: 1,
          },
        },
      });
    }

    return { order, payment };
  });

  if (Math.round(amount * 100) <= 0) {
    const paymentResult = await applyPaymentSuccess({
      orderNo,
      transactionNo: `FREE_${orderNo}`,
      success: true,
    });

    if (paymentResult.statusCode !== 200 || !paymentResult.payload.ok) {
      return paymentResult;
    }

    const orderDetailResult = await getOrder(orderNo, {
      sessionToken,
      userId: resolvedUserId,
    });

    if (orderDetailResult.statusCode !== 200 || !orderDetailResult.payload.ok) {
      return orderDetailResult;
    }

    return {
      statusCode: 201,
      payload: {
        ok: true,
        data: {
          order: serializeOrderSummary({
            ...result.order,
            status: orderDetailResult.payload.data.order.status,
            amount: orderDetailResult.payload.data.order.amount / 100,
          }),
          payment: serializePaymentSummary(
            {
              ...result.payment,
              status: orderDetailResult.payload.data.payment
                ? orderDetailResult.payload.data.payment.status
                : "PAID",
            },
            {
              required: false,
              request: null,
            }
          ),
          membership: orderDetailResult.payload.data.membership,
          idempotent: Boolean(paymentResult.payload.data && paymentResult.payload.data.idempotent),
        },
      },
    };
  }

  let preparedPayment;
  try {
    preparedPayment = await createWechatPaymentRequest({
      order: result.order,
      payment: result.payment,
      user,
      group,
    });
  } catch (error) {
    return {
      statusCode: error && Number.isInteger(error.statusCode) ? error.statusCode : 502,
      payload: {
        ok: false,
        message: error && error.message ? error.message : "微信支付下单失败，请稍后重试",
      },
    };
  }

  return {
    statusCode: 201,
    payload: {
      ok: true,
      data: {
        order: serializeOrderSummary(result.order),
        payment: serializePaymentSummary(preparedPayment.payment || result.payment, {
          request: preparedPayment.request,
        }),
        membership: null,
        idempotent: false,
      },
    },
  };
}

async function reapplyJoinReview(input) {
  const { groupId, userId } = input;
  const { user, group, policy, membership } = await findPreviewDependencies(groupId, userId);

  if (!user) {
    return { statusCode: 404, payload: { ok: false, message: "用户不存在" } };
  }

  if (!group || !policy) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在或未配置策略" } };
  }

  if (!policy.allowJoin || group.status !== "ACTIVE") {
    return { statusCode: 400, payload: { ok: false, message: "当前星球不可加入" } };
  }

  if (!policy.needExamine) {
    return { statusCode: 400, payload: { ok: false, message: "当前星球未开启加入审核，无需重新提交" } };
  }

  if (membershipIsActive(membership)) {
    return { statusCode: 409, payload: { ok: false, message: "用户已是有效成员，无需重新提交审核" } };
  }

  const reviewApplication = await findLatestJoinReviewApplication(groupId, userId);
  if (!reviewApplication) {
    return { statusCode: 404, payload: { ok: false, message: "当前没有可重新提交的加入申请" } };
  }

  if (reviewApplication.reviewStatus === "PENDING") {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          order: {
            id: reviewApplication.order.id,
            orderNo: reviewApplication.order.orderNo,
            status: reviewApplication.order.status,
            amount: Math.round(toMoneyNumber(reviewApplication.order.amount) * 100),
            discountAmount: Math.round(toMoneyNumber(reviewApplication.order.discountAmount) * 100),
            createdAt: reviewApplication.order.createdAt,
          },
          payment: {
            id: reviewApplication.payment.id,
            channel: reviewApplication.payment.channel,
            status: reviewApplication.payment.status,
          },
          membership: buildReviewMembershipPayload(reviewApplication),
          idempotent: true,
        },
      },
    };
  }

  if (reviewApplication.reviewStatus !== "REJECTED") {
    return { statusCode: 409, payload: { ok: false, message: "当前申请状态不支持重新提交审核" } };
  }

  const submittedAt = new Date();
  const previousReapplyCount =
    reviewApplication.payment.rawPayload && typeof reviewApplication.payment.rawPayload === "object"
      ? Number(reviewApplication.payment.rawPayload.reapplyCount)
      : 0;
  const nextRawPayload = {
    ...(reviewApplication.payment.rawPayload || {}),
    reviewRequired: true,
    reviewStatus: "PENDING",
    reviewReason: "",
    reviewSubmittedAt: submittedAt.toISOString(),
    reviewedAt: null,
    reviewerUserId: null,
    reapplyCount: Number.isFinite(previousReapplyCount) ? previousReapplyCount + 1 : 1,
    lastReappliedAt: submittedAt.toISOString(),
  };

  const result = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.paymentRecord.update({
      where: {
        id: reviewApplication.payment.id,
      },
      data: {
        rawPayload: nextRawPayload,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: reviewApplication.order.id,
        fromStatus: reviewApplication.order.status,
        toStatus: reviewApplication.order.status,
        reason: "membership_review_reapplied",
        payload: {
          previousReviewStatus: reviewApplication.reviewStatus,
          submittedAt: submittedAt.toISOString(),
        },
      },
    });

    await tx.outboxJob.createMany({
      data: [
        {
          topic: "membership.review_pending",
          aggregateType: "order",
          aggregateId: reviewApplication.order.id,
          payload: {
            groupId: reviewApplication.order.groupId,
            userId: reviewApplication.order.userId,
            orderNo: reviewApplication.order.orderNo,
            reapply: true,
          },
        },
        {
          topic: "analytics.refresh",
          aggregateType: "group",
          aggregateId: reviewApplication.order.groupId,
          payload: {
            source: "membership_review_reapplied",
            orderId: reviewApplication.order.id,
          },
        },
      ],
    });

    return {
      order: reviewApplication.order,
      payment: updatedPayment,
      membership: buildReviewMembershipPayload({
        order: reviewApplication.order,
        reviewStatus: "PENDING",
        reviewReason: "",
        reviewedAt: null,
      }),
    };
  });

  return {
    statusCode: 200,
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
        membership: result.membership,
        idempotent: false,
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

  if (payment.status === "PAID" && payment.transactionNo && transactionNo && payment.transactionNo !== transactionNo) {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: "订单已绑定其他微信交易号，不能重复入账",
      },
    };
  }

  if (order.type === "ARTICLE_UNLOCK") {
    return applyArticleUnlockPaymentSuccess({
      order,
      payment,
      transactionNo,
      success,
    });
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
    const membershipPayload = await resolveMembershipPayload(order.groupId, order.userId, membership);

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
          membership: membershipPayload,
          idempotent: true,
        },
      },
    };
  }

  const group = await prisma.group.findUnique({
    where: { id: order.groupId },
    include: {
      permissionPolicy: true,
    },
  });

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

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

    const paidAt = new Date();
    const paidOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentStatus: "PAID",
        netAmount: order.amount,
        paidAt,
      },
    });

    const nextPaidRawPayload = {
      ...(payment.rawPayload || {}),
      stage: "paid",
      transactionNo,
    };

    const paidPayment = await tx.paymentRecord.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        transactionNo,
        paidAt,
        rawPayload: nextPaidRawPayload,
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

    if (order.type === "GROUP_RENEWAL") {
      await tx.analyticsEvent.create({
        data: {
          groupId: order.groupId,
          userId: order.userId,
          eventType: "RENEWAL_PAID",
          targetType: "ORDER",
          targetId: order.id,
          eventDedupKey: `${order.orderNo}:renewal_paid`,
          properties: {
            orderNo: order.orderNo,
            paidAmount: Math.round(toMoneyNumber(order.amount) * 100),
            transactionNo,
          },
        },
      });

      const membership = await activateRenewalMembership(tx, paidOrder, group);
      return { order: paidOrder, payment: paidPayment, membership, idempotent: false };
    }

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

    if (group.permissionPolicy && group.permissionPolicy.needExamine) {
      const reviewPendingPayload = {
        ...nextPaidRawPayload,
        reviewRequired: true,
        reviewStatus: "PENDING",
        reviewReason: "",
        reviewSubmittedAt: paidAt.toISOString(),
        reviewedAt: null,
        reviewerUserId: null,
      };

      const pendingPayment = await tx.paymentRecord.update({
        where: { id: payment.id },
        data: {
          rawPayload: reviewPendingPayload,
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: order.id,
          fromStatus: "PAID",
          toStatus: "PAID",
          reason: "membership_review_pending",
          payload: {
            transactionNo,
          },
        },
      });

      await tx.outboxJob.createMany({
        data: [
          {
            topic: "membership.review_pending",
            aggregateType: "order",
            aggregateId: order.id,
            payload: {
              groupId: order.groupId,
              userId: order.userId,
              orderNo: order.orderNo,
            },
          },
          {
            topic: "analytics.refresh",
            aggregateType: "group",
            aggregateId: order.groupId,
            payload: {
              source: "membership_review_pending",
              orderId: order.id,
            },
          },
        ],
      });

      return {
        order: paidOrder,
        payment: pendingPayment,
        membership: buildReviewMembershipPayload({
          order: paidOrder,
          reviewStatus: "PENDING",
          reviewReason: "",
          reviewedAt: null,
        }),
        idempotent: false,
      };
    }

    const membership = await activateJoinMembership(tx, paidOrder, group);
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
        membership: result.membership,
        idempotent: result.idempotent,
      },
    },
  };
}

async function trySyncWechatPaymentStatus(order, payment) {
  if (!order || !payment) {
    return false;
  }

  if (payment.channel !== "WECHAT") {
    return false;
  }

  if (order.paymentStatus === "PAID" || payment.status === "PAID") {
    return false;
  }

  if (!order.orderNo) {
    return false;
  }

  try {
    const queriedOrder = await queryJsapiPaymentOrderByOutTradeNo(order.orderNo);
    if (queriedOrder.tradeState !== "SUCCESS" || !queriedOrder.transactionNo) {
      return false;
    }

    const paymentResult = await applyPaymentSuccess({
      orderNo: order.orderNo,
      transactionNo: queriedOrder.transactionNo,
      success: true,
    });

    return paymentResult.statusCode === 200 && paymentResult.payload && paymentResult.payload.ok;
  } catch (error) {
    return false;
  }
}

async function reviewJoinApplication(input = {}) {
  const groupId = String(input.groupId || "").trim();
  const orderNo = String(input.orderNo || "").trim();
  const action = String(input.action || "").trim().toUpperCase();
  const reviewReason = String(input.reviewReason || "").trim();
  const reviewerUserId = String(input.reviewerUserId || "").trim() || null;

  if (!groupId || !orderNo) {
    return { statusCode: 400, payload: { ok: false, message: "缺少审核所需的星球或订单信息" } };
  }

  if (action !== "APPROVE" && action !== "REJECT") {
    return { statusCode: 400, payload: { ok: false, message: "不支持的审核操作" } };
  }

  if (action === "REJECT" && !reviewReason) {
    return { statusCode: 400, payload: { ok: false, message: "驳回申请时必须填写原因" } };
  }

  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: {
      group: {
        include: {
          permissionPolicy: true,
        },
      },
      paymentRecords: {
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
  });

  if (!order || order.groupId !== groupId || order.type !== "GROUP_JOIN") {
    return { statusCode: 404, payload: { ok: false, message: "待审核订单不存在" } };
  }

  const payment = order.paymentRecords && order.paymentRecords.length ? order.paymentRecords[0] : null;
  if (!payment || payment.status !== "PAID") {
    return { statusCode: 400, payload: { ok: false, message: "当前订单尚未完成支付" } };
  }

  const reviewInfo = parsePaymentReviewInfo(payment);
  const requiresReview =
    reviewInfo.reviewRequired || Boolean(order.group && order.group.permissionPolicy && order.group.permissionPolicy.needExamine);

  if (!requiresReview) {
    return { statusCode: 400, payload: { ok: false, message: "当前订单不需要加入审核" } };
  }

  const existingMembership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: order.groupId,
        userId: order.userId,
      },
    },
  });

  if (action === "APPROVE" && reviewInfo.reviewStatus === "APPROVED" && membershipIsActive(existingMembership)) {
    const membershipPayload = await resolveMembershipPayload(order.groupId, order.userId, existingMembership);
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          action,
          orderNo: order.orderNo,
          membership: membershipPayload,
          idempotent: true,
        },
      },
    };
  }

  if (action === "REJECT" && reviewInfo.reviewStatus === "REJECTED") {
    const membershipPayload = await resolveMembershipPayload(order.groupId, order.userId, existingMembership);
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          action,
          orderNo: order.orderNo,
          membership: membershipPayload,
          idempotent: true,
        },
      },
    };
  }

  if (action === "REJECT" && membershipIsActive(existingMembership)) {
    return { statusCode: 409, payload: { ok: false, message: "成员资格已经生效，不能再驳回该订单" } };
  }

  const reviewedAt = new Date();
  const nextReviewStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

  const result = await prisma.$transaction(async (tx) => {
    const nextRawPayload = {
      ...(payment.rawPayload || {}),
      stage: "paid",
      transactionNo: payment.transactionNo || null,
      reviewRequired: true,
      reviewStatus: nextReviewStatus,
      reviewReason: action === "REJECT" ? reviewReason : "",
      reviewSubmittedAt:
        reviewInfo.reviewSubmittedAt ||
        (payment.paidAt ? payment.paidAt.toISOString() : null) ||
        (order.paidAt ? order.paidAt.toISOString() : null) ||
        order.createdAt.toISOString(),
      reviewedAt: reviewedAt.toISOString(),
      reviewerUserId,
    };

    const updatedPayment = await tx.paymentRecord.update({
      where: { id: payment.id },
      data: {
        rawPayload: nextRawPayload,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        reason: action === "APPROVE" ? "membership_review_approved" : "membership_review_rejected",
        payload: {
          reviewReason: action === "REJECT" ? reviewReason : "",
          reviewerUserId,
        },
      },
    });

    if (action === "REJECT") {
      await tx.outboxJob.create({
        data: {
          topic: "membership.review_rejected",
          aggregateType: "order",
          aggregateId: order.id,
          payload: {
            groupId: order.groupId,
            userId: order.userId,
            orderNo: order.orderNo,
            reviewReason,
          },
        },
      });

      return {
        payment: updatedPayment,
        membership: buildReviewMembershipPayload({
          order,
          reviewStatus: nextReviewStatus,
          reviewReason,
          reviewedAt: reviewedAt.toISOString(),
        }),
      };
    }

    const membership = await activateJoinMembership(tx, order, order.group);
    return { payment: updatedPayment, membership };
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        action,
        orderNo: order.orderNo,
        membership: result.membership,
        idempotent: false,
      },
    },
  };
}

async function getMembershipStatus(groupId, userId) {
  if (!groupId || !userId) {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: null,
      },
    };
  }

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
      data: await resolveMembershipPayload(groupId, userId, membership),
    },
  };
}

async function getOrder(orderNo, options = {}) {
  let order = await prisma.order.findUnique({
    where: { orderNo },
  });
  if (!order) {
    return { statusCode: 404, payload: { ok: false, message: "订单不存在" } };
  }

  const hasIdentityContext = Boolean(String(options.sessionToken || "").trim() || String(options.userId || "").trim());
  if (hasIdentityContext) {
    const identityResult = await resolveOrderUserId(options.sessionToken, options.userId);
    if (!identityResult.ok) {
      return {
        statusCode: identityResult.statusCode,
        payload: {
          ok: false,
          message: identityResult.message,
        },
      };
    }

    if (identityResult.userId !== order.userId) {
      return {
        statusCode: 403,
        payload: {
          ok: false,
          message: "无权查看该订单",
        },
      };
    }
  }

  let payment = await prisma.paymentRecord.findFirst({ where: { orderId: order.id } });

  if (hasIdentityContext && (await trySyncWechatPaymentStatus(order, payment))) {
    const refreshedOrder = await prisma.order.findUnique({
      where: { orderNo },
    });
    if (refreshedOrder) {
      order = refreshedOrder;
      payment = await prisma.paymentRecord.findFirst({ where: { orderId: order.id } });
    }
  }

  if (order.type === "ARTICLE_UNLOCK") {
    const unlock = await prisma.articleUnlock.findUnique({
      where: {
        orderId: order.id,
      },
    });

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
          membership: null,
          unlock: unlock
            ? {
                id: unlock.id,
                articleId: unlock.articleId,
                groupId: unlock.groupId,
                userId: unlock.userId,
                unlockedAt: unlock.unlockedAt,
                isUnlocked: true,
              }
            : null,
        },
      },
    };
  }

  const membership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: order.groupId,
        userId: order.userId,
      },
    },
  });

  const membershipPayload = await resolveMembershipPayload(order.groupId, order.userId, membership);

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
        membership: membershipPayload,
      },
    },
  };
}

async function listJoinCoupons(input = {}) {
  const groupId = String(input.groupId || "").trim();
  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球 ID" } };
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      priceAmount: true,
      joinType: true,
    },
  });

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  const coupons = await prisma.coupon.findMany({
    where: {
      groupId,
      type: "PROMOTION",
      status: "ACTIVE",
    },
    orderBy: [{ amount: "desc" }, { createdAt: "desc" }],
  });

  const rows = coupons
    .map((coupon) => resolveJoinCoupon(coupon, groupId).coupon)
    .filter(Boolean)
    .map((coupon, index) => ({
      ...serializeJoinCoupon(coupon),
      isRecommended: index === 0,
    }));

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          joinType: group.joinType,
          priceAmount: Math.round(toMoneyNumber(group.priceAmount) * 100),
        },
        items: rows,
      },
    },
  };
}

async function findPreferredRenewalCoupon(groupId) {
  const coupons = await prisma.coupon.findMany({
    where: {
      groupId,
      type: "RENEWAL",
      status: "ACTIVE",
    },
    orderBy: [{ amount: "desc" }, { createdAt: "desc" }],
  });

  for (const coupon of coupons) {
    const resolved = resolveRenewalCoupon(coupon, groupId);
    if (resolved.coupon) {
      return resolved.coupon;
    }
  }

  return null;
}

async function listJoinChannels(input = {}) {
  const groupId = String(input.groupId || "").trim();
  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球 ID" } };
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  const channels = await prisma.promotionChannel.findMany({
    where: {
      groupId,
      isEnabled: true,
    },
    orderBy: [{ createdAt: "asc" }],
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
        },
        items: channels.map(serializeJoinChannel),
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
  listJoinCoupons,
  listJoinChannels,
  createJoinOrder,
  createRenewalOrder,
  findPreferredRenewalCoupon,
  reapplyJoinReview,
  applyPaymentSuccess,
  getMembershipStatus,
  listGroupJoinReviewApplications,
  reviewJoinApplication,
  getOrder,
  getDebugState,
};
