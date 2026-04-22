const { prisma } = require("../db/prisma");
const { ensureRenewalSettingColumns } = require("./renewalSettingSchemaService");
const { queryDomesticRefundByOutRefundNo, requestDomesticRefund } = require("./wechatPayService");

const RENEWAL_SETTING_MODEL_COLUMNS = [
  "id",
  "group_id",
  "enabled",
  "limit_window",
  "amount",
  "original_amount",
  "discounted_percentage",
  "expiring_enabled",
  "advance_amount",
  "advance_discount_percentage",
  "advance_enabled",
  "grace_amount",
  "grace_discount_percentage",
  "grace_enabled",
  "audience",
  "allow_coupon_stack",
  "min_renew_count",
  "mode",
  "duration",
  "begin_time",
  "end_time",
  "guidance",
  "renewal_url",
  "created_at",
  "updated_at",
];
const SELF_REFUND_WINDOW_MS = 72 * 60 * 60 * 1000;
const SELF_REFUND_WINDOW_HOURS = 72;

function generateSlug(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "")
    .slice(0, 15);
  const random = Math.random().toString(36).slice(2, 6);
  return `${base}_${random}`;
}

function buildGroupProfile(group, ownerProfile, options = {}) {
  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    avatarImageUrl: group.avatarUrl || "",
    coverImageUrl: group.coverUrl || "",
    intro: group.intro || "",
    price: Number(group.priceAmount),
    priceLabel: group.joinType === "FREE" ? "免费加入" : `¥ ${group.priceAmount}/年`,
    joinType: group.billingPeriod === "YEAR" ? "rolling" : "calendar",
    isFree: group.joinType === "FREE",
    requireInviteCode: group.joinType === "INVITE_ONLY",
    ownerName: ownerProfile?.nickname || "未知",
    ownerTagline: ownerProfile?.bio || "",
    category: group.description || "其他",
    memberCount: group.memberCount,
    postCount: group.contentCount,
    createdAt: group.createdAt.toISOString().split("T")[0],
    joined: typeof options.joined === "boolean" ? options.joined : undefined,
    joinedAt: options.joinedAt ? new Date(options.joinedAt).toISOString() : "",
    isPaid: typeof options.isPaid === "boolean" ? options.isPaid : undefined,
    canRefundOnExit: typeof options.canRefundOnExit === "boolean" ? options.canRefundOnExit : undefined,
    refundAmount: typeof options.refundAmount === "number" ? options.refundAmount : undefined,
    refundDeadline: options.refundDeadline ? new Date(options.refundDeadline).toISOString() : "",
  };
}

function buildMemberRoleLabel(member) {
  if (!member) {
    return "成员";
  }

  if (member.isOwner) {
    return "星主";
  }

  if (member.staffRole === "PARTNER") {
    return "合伙人";
  }

  if (member.staffRole === "ADMIN") {
    return "管理员";
  }

  if (member.staffRole === "OPERATOR") {
    return "运营";
  }

  return "成员";
}

function buildGroupMemberListItem(member) {
  const profile = member.user && member.user.profile ? member.user.profile : null;

  return {
    id: member.userId,
    memberId: member.id || "",
    memberNo: typeof member.memberNo === "number" ? member.memberNo : null,
    nickname: profile && profile.nickname ? profile.nickname : "微信用户",
    avatarUrl: profile && profile.avatarUrl ? profile.avatarUrl : "",
    mobile: member.user && member.user.mobile ? member.user.mobile : "",
    wechatNo:
      member.wechatNo ||
      (profile && profile.wechatNo ? profile.wechatNo : "") ||
      "",
    remark: profile && profile.remark ? profile.remark : "",
    roleLabel: buildMemberRoleLabel(member),
    isOwner: Boolean(member.isOwner),
    isPaid: Boolean(member.isPaid),
    status: member.status,
    joinedAt: member.joinedAt ? member.joinedAt.toISOString() : "",
    expireAt: member.expireAt ? member.expireAt.toISOString() : "",
    description: profile && profile.bio ? profile.bio : "",
  };
}

function membershipIsActive(membership) {
  if (!membership) {
    return false;
  }

  if (membership.status !== "ACTIVE") {
    return false;
  }

  if (!membership.expireAt) {
    return true;
  }

  return new Date(membership.expireAt).getTime() > Date.now();
}

function toFenAmount(value) {
  const normalizedValue = Number(value || 0);
  if (!Number.isFinite(normalizedValue)) {
    return 0;
  }

  return Math.max(0, Math.round(normalizedValue * 100));
}

function buildRefundDeadline(inputTime) {
  const timeValue = inputTime ? new Date(inputTime).getTime() : NaN;
  if (!Number.isFinite(timeValue)) {
    return null;
  }

  return new Date(timeValue + SELF_REFUND_WINDOW_MS);
}

function getRefundWindowStatus(order, payment, now = new Date()) {
  const paidAtTime = order && order.paidAt ? new Date(order.paidAt).getTime() : NaN;
  const amountInFen = order ? toFenAmount(order.amount) : 0;
  const withinWindow = Number.isFinite(paidAtTime) ? now.getTime() - paidAtTime <= SELF_REFUND_WINDOW_MS : false;
  const deadline = Number.isFinite(paidAtTime) ? new Date(paidAtTime + SELF_REFUND_WINDOW_MS) : null;
  const refundable = Boolean(
    order &&
      payment &&
      order.status === "PAID" &&
      order.paymentStatus === "PAID" &&
      payment.status === "PAID" &&
      amountInFen > 0 &&
      withinWindow
  );

  return {
    refundable,
    amountInFen,
    deadline,
    reason: !order
      ? "未找到加入订单"
      : amountInFen <= 0
        ? "免费加入无需退款"
        : !payment || payment.status !== "PAID" || order.paymentStatus !== "PAID" || order.status !== "PAID"
          ? "订单未处于可退款状态"
          : withinWindow
            ? ""
            : `已超过 ${SELF_REFUND_WINDOW_HOURS} 小时退款期`,
  };
}

function parseRefundReviewInfo(payment) {
  const rawPayload = payment && payment.rawPayload && typeof payment.rawPayload === "object" ? payment.rawPayload : {};
  const reviewStatus = String(rawPayload.refundReviewStatus || "").trim().toUpperCase();

  return {
    reviewRequired: Boolean(rawPayload.refundReviewRequired || reviewStatus),
    reviewStatus: ["PENDING", "REJECTED", "APPROVED"].includes(reviewStatus) ? reviewStatus : "",
    reviewReason: String(rawPayload.refundReviewReason || "").trim(),
    submittedAt: String(rawPayload.refundRequestedAt || "").trim(),
    reviewedAt: String(rawPayload.refundReviewedAt || "").trim(),
    reviewerUserId: String(rawPayload.refundReviewerUserId || "").trim(),
  };
}

function parseWechatRefundInfo(payment) {
  const rawPayload = payment && payment.rawPayload && typeof payment.rawPayload === "object" ? payment.rawPayload : {};
  const refundStatus = String(rawPayload.wechatRefundStatus || "").trim().toUpperCase();

  return {
    outRefundNo: String(rawPayload.wechatRefundOutNo || "").trim(),
    refundId: String(rawPayload.wechatRefundId || "").trim(),
    refundStatus,
    requestedAt: String(rawPayload.wechatRefundRequestedAt || "").trim(),
    successAt: String(rawPayload.wechatRefundSuccessAt || "").trim(),
    userReceivedAccount: String(rawPayload.wechatRefundUserReceivedAccount || "").trim(),
    reason: String(rawPayload.wechatRefundReason || "").trim(),
  };
}

function buildRefundReviewRawPayload(payment, overrides = {}) {
  const currentPayload = payment && payment.rawPayload && typeof payment.rawPayload === "object" ? payment.rawPayload : {};

  return {
    ...currentPayload,
    ...overrides,
  };
}

function buildWechatRefundOutNo(order, payment) {
  const existingRefundInfo = parseWechatRefundInfo(payment);
  if (existingRefundInfo.outRefundNo) {
    return existingRefundInfo.outRefundNo;
  }

  const source = String((order && (order.orderNo || order.id)) || `refund_${Date.now()}`);
  return `RF_${source}`.replace(/[^0-9A-Za-z_\-|*@]/g, "_").slice(0, 64);
}

async function requestWechatRefundForOrder(payload = {}) {
  const { order, payment, refundAmount, reason } = payload;

  if (!order || !payment) {
    throw new Error("缺少退款订单或支付记录");
  }

  const refundAmountInFen = Math.round(Number(refundAmount || 0));
  const totalAmountInFen = toFenAmount(order.amount);

  if (!Number.isFinite(refundAmountInFen) || refundAmountInFen <= 0) {
    throw new Error("退款金额无效");
  }

  if (!Number.isFinite(totalAmountInFen) || totalAmountInFen <= 0) {
    throw new Error("原订单金额无效");
  }

  const outRefundNo = buildWechatRefundOutNo(order, payment);
  const requestedAt = new Date().toISOString();
  const refundResult = await requestDomesticRefund({
    orderNo: order.orderNo,
    transactionNo: payment.transactionNo,
    outRefundNo,
    refundAmountInFen,
    totalAmountInFen,
    reason,
  });
  const refundStatus = String(refundResult.status || "").trim().toUpperCase() || "PROCESSING";
  const refundSettled = refundStatus === "SUCCESS";

  return {
    refundStatus,
    refundSettled,
    extraPaymentRawPayload: buildRefundReviewRawPayload(payment, {
      wechatRefundOutNo: outRefundNo,
      wechatRefundId: refundResult.refundId || "",
      wechatRefundStatus: refundStatus,
      wechatRefundRequestedAt: requestedAt,
      wechatRefundSuccessAt: refundSettled ? requestedAt : "",
      wechatRefundUserReceivedAccount: refundResult.userReceivedAccount || "",
      wechatRefundReason: String(reason || "").trim(),
      wechatRefundRawResponse: refundResult.rawResponse || {},
    }),
    refundResult,
  };
}

async function findLatestJoinOrderWithPayment(client, groupId, userId) {
  return client.order.findFirst({
    where: {
      groupId,
      userId,
      type: "GROUP_JOIN",
    },
    include: {
      paymentRecords: {
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });
}

async function applyRefundAndQuitMembership(tx, payload) {
  const {
    groupId,
    userId,
    membershipId,
    membershipIsPaid,
    order,
    payment,
    refundAmount,
    now,
    reason,
    extraPaymentRawPayload,
    markPaymentRefunded = true,
  } = payload;

  await tx.groupStaff.updateMany({
    where: {
      groupId,
      userId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  await tx.groupNotificationSubscription.updateMany({
    where: {
      groupId,
      userId,
    },
    data: {
      enabled: false,
    },
  });

  await tx.groupMember.update({
    where: {
      id: membershipId,
    },
    data: {
      status: "QUIT",
      expireAt: null,
      isPaid: false,
      lastActiveAt: now,
    },
  });

  if (markPaymentRefunded) {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "REFUNDED",
        paymentStatus: "REFUNDED",
      },
    });
  }

  const paymentUpdateData = {
    rawPayload: {
      ...(payment.rawPayload && typeof payment.rawPayload === "object" ? payment.rawPayload : {}),
      ...(extraPaymentRawPayload && typeof extraPaymentRawPayload === "object" ? extraPaymentRawPayload : {}),
      refundReason: reason,
      refundAppliedAt: now.toISOString(),
    },
  };

  if (markPaymentRefunded) {
    paymentUpdateData.status = "REFUNDED";
    paymentUpdateData.refundedAt = now;
  }

  await tx.paymentRecord.update({
    where: { id: payment.id },
    data: paymentUpdateData,
  });

  await tx.orderStatusLog.create({
    data: {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: markPaymentRefunded ? "REFUNDED" : order.status,
      reason,
      payload: {
        groupId,
        userId,
        refundAmount,
        paymentRecordId: payment.id,
        membershipWasPaid: Boolean(membershipIsPaid),
        refundSettled: Boolean(markPaymentRefunded),
        wechatRefundStatus:
          extraPaymentRawPayload && typeof extraPaymentRawPayload === "object"
            ? String(extraPaymentRawPayload.wechatRefundStatus || "").trim()
            : "",
        wechatRefundOutNo:
          extraPaymentRawPayload && typeof extraPaymentRawPayload === "object"
            ? String(extraPaymentRawPayload.wechatRefundOutNo || "").trim()
            : "",
      },
    },
  });

  await syncActiveMemberAggregates(tx, groupId);
}

function buildRefundManagementMemberItem(membership, order, payment, now = new Date()) {
  const refundWindow = getRefundWindowStatus(order, payment, now);
  const profile = membership && membership.user && membership.user.profile ? membership.user.profile : null;

  return {
    userId: membership.userId,
    memberId: membership.id,
    nickname: profile && profile.nickname ? profile.nickname : "微信用户",
    avatarUrl: profile && profile.avatarUrl ? profile.avatarUrl : "",
    mobile: membership.user && membership.user.mobile ? membership.user.mobile : "",
    roleLabel: buildMemberRoleLabel(membership),
    isOwner: Boolean(membership.isOwner),
    isPaid: Boolean(membership.isPaid),
    joinedAt: membership.joinedAt ? membership.joinedAt.toISOString() : "",
    expireAt: membership.expireAt ? membership.expireAt.toISOString() : "",
    orderNo: order && order.orderNo ? order.orderNo : "",
    refundAmount: refundWindow.amountInFen,
    canRefund: refundWindow.refundable,
    refundDeadline: refundWindow.deadline ? refundWindow.deadline.toISOString() : "",
    refundHint: refundWindow.refundable ? `仍在 ${SELF_REFUND_WINDOW_HOURS} 小时退款期内` : refundWindow.reason,
  };
}

function buildCreatorRefundApprovalItem(order, payment, now = new Date()) {
  const refundReviewInfo = parseRefundReviewInfo(payment);
  const userProfile = order && order.user && order.user.profile ? order.user.profile : null;
  const requestedAt = refundReviewInfo.submittedAt || (order.paidAt ? order.paidAt.toISOString() : order.createdAt.toISOString());

  return {
    groupId: order.groupId || "",
    groupName: order.group && order.group.name ? order.group.name : "饮视星球",
    orderNo: order.orderNo,
    memberUserId: order.userId,
    nickname: userProfile && userProfile.nickname ? userProfile.nickname : "微信用户",
    avatarUrl: userProfile && userProfile.avatarUrl ? userProfile.avatarUrl : "",
    mobile: order.user && order.user.mobile ? order.user.mobile : "",
    refundAmount: toFenAmount(order.amount),
    requestedAt,
    refundHint: refundReviewInfo.reviewReason || "等待星主审批",
    canReview: refundReviewInfo.reviewStatus === "PENDING",
  };
}

function buildJoinedRefundStatusItem(order, payment, membership, now = new Date()) {
  const refundReviewInfo = parseRefundReviewInfo(payment);
  const wechatRefundInfo = parseWechatRefundInfo(payment);
  const refundWindow = getRefundWindowStatus(order, payment, now);
  const group = order.group || null;
  const ownerProfile = group && group.owner && group.owner.profile ? group.owner.profile : null;

  let status = "";
  let statusLabel = "";
  let actionLabel = "";
  let actionable = false;
  let hint = "";

  if (
    order.paymentStatus === "REFUNDED" ||
    (payment && payment.status === "REFUNDED") ||
    wechatRefundInfo.refundStatus === "SUCCESS"
  ) {
    status = "APPROVED";
    statusLabel = "已通过并退款";
    hint =
      wechatRefundInfo.successAt || refundReviewInfo.reviewedAt
        ? `退款完成于 ${wechatRefundInfo.successAt || refundReviewInfo.reviewedAt}`
        : "退款已完成";
  } else if (refundReviewInfo.reviewStatus === "APPROVED") {
    status = "PROCESSING";
    statusLabel = wechatRefundInfo.refundStatus === "ABNORMAL" ? "退款异常" : "退款处理中";
    hint =
      wechatRefundInfo.refundStatus === "ABNORMAL"
        ? "微信退款存在异常，请稍后查询退款状态"
        : wechatRefundInfo.requestedAt
          ? `退款已受理，零钱一般 5 分钟内到账，申请时间 ${wechatRefundInfo.requestedAt}`
          : "退款已受理，正在等待微信处理";
  } else if (refundReviewInfo.reviewStatus === "PENDING") {
    status = "PENDING";
    statusLabel = "审批中";
    hint = refundReviewInfo.submittedAt ? `已提交于 ${refundReviewInfo.submittedAt}` : "退款申请正在等待星主审批";
  } else if (refundReviewInfo.reviewStatus === "REJECTED") {
    status = "REJECTED";
    statusLabel = "已驳回";
    actionable = refundWindow.refundable && membershipIsActive(membership);
    actionLabel = actionable ? "重新申请" : "";
    hint = refundReviewInfo.reviewReason || "星主已驳回退款申请";
  } else if (refundWindow.refundable && membershipIsActive(membership)) {
    status = "AVAILABLE";
    statusLabel = "可申请";
    actionable = true;
    actionLabel = "申请退款";
    hint = refundWindow.deadline ? `请在 ${refundWindow.deadline.toISOString()} 前提交退款申请` : `仍在 ${SELF_REFUND_WINDOW_HOURS} 小时退款期内`;
  } else if (membershipIsActive(membership) && toFenAmount(order.amount) > 0) {
    status = "EXPIRED";
    statusLabel = "已过期";
    hint = refundWindow.reason || `已超过 ${SELF_REFUND_WINDOW_HOURS} 小时退款期`;
  } else {
    status = "NONE";
    statusLabel = "无可用退款";
    hint = "当前没有可处理的退款申请";
  }

  return {
    groupId: order.groupId || "",
    groupName: group && group.name ? group.name : "饮视星球",
    ownerName: ownerProfile && ownerProfile.nickname ? ownerProfile.nickname : "星主",
    orderNo: order.orderNo,
    refundAmount: toFenAmount(order.amount),
    status,
    statusLabel,
    actionLabel,
    actionable,
    hint,
    submittedAt: refundReviewInfo.submittedAt,
    reviewedAt: refundReviewInfo.reviewedAt,
    reviewReason: refundReviewInfo.reviewReason,
    updatedAt: order.updatedAt ? order.updatedAt.toISOString() : order.createdAt.toISOString(),
  };
}

async function getRenewalSettingWriteCompatibility() {
  const { missingColumns, addedColumns } = await ensureRenewalSettingColumns(RENEWAL_SETTING_MODEL_COLUMNS);

  if (addedColumns.length) {
    console.info(`[renewal_settings] auto added columns for planet create: ${addedColumns.join(", ")}`);
  }

  return {
    canWrite: missingColumns.length === 0,
    missingColumns,
  };
}

function buildDefaultRenewalSettingData(groupId, amount) {
  return {
    groupId,
    enabled: true,
    limitWindow: false,
    amount,
    originalAmount: amount,
    discountedPercentage: 100,
    expiringEnabled: true,
    advanceAmount: 0,
    advanceDiscountPercentage: 100,
    advanceEnabled: true,
    graceAmount: 0,
    graceDiscountPercentage: 100,
    graceEnabled: true,
    audience: "renewable_members",
    allowCouponStack: true,
    minRenewCount: 0,
    mode: "period",
    duration: "1Y",
    guidance: "",
    renewalUrl: "",
  };
}

async function getActiveSession(sessionToken) {
  if (!sessionToken) {
    return {
      error: { statusCode: 401, payload: { ok: false, message: "请先登录" } },
    };
  }

  const session = await prisma.authSession.findUnique({
    where: { sessionToken },
    include: {
      user: {
        include: { profile: true },
      },
    },
  });

  if (!session || session.status !== "ACTIVE") {
    return {
      error: { statusCode: 401, payload: { ok: false, message: "登录态无效" } },
    };
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    return {
      error: { statusCode: 401, payload: { ok: false, message: "登录态已过期" } },
    };
  }

  return { session };
}

async function syncActiveMemberAggregates(tx, groupId) {
  const now = new Date();
  const activeMemberWhere = {
    groupId,
    status: "ACTIVE",
    OR: [{ expireAt: null }, { expireAt: { gt: now } }],
  };

  const [memberCount, paidMemberCount] = await Promise.all([
    tx.groupMember.count({
      where: activeMemberWhere,
    }),
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

async function leavePlanetMembership(sessionToken, input = {}) {
  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;
  const groupId = String(input.groupId || "").trim();

  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const [group, membership] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        status: true,
        ownerUserId: true,
      },
    }),
    prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: session.userId,
        },
      },
    }),
  ]);

  if (!group || group.status === "CLOSED") {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在或已删除" } };
  }

  if (group.ownerUserId === session.userId) {
    return { statusCode: 400, payload: { ok: false, message: "星主不能通过此入口退出星球" } };
  }

  if (!membership) {
    return { statusCode: 400, payload: { ok: false, message: "你还不是当前星球成员" } };
  }

  if (membership.status === "QUIT") {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          groupId,
          membershipStatus: membership.status,
          refunded: false,
          refundAmount: 0,
          orderNo: "",
          idempotent: true,
        },
      },
    };
  }

  const latestJoinOrder = await findLatestJoinOrderWithPayment(prisma, groupId, session.userId);
  const latestJoinPayment =
    latestJoinOrder && latestJoinOrder.paymentRecords && latestJoinOrder.paymentRecords.length
      ? latestJoinOrder.paymentRecords[0]
      : null;
  const refundWindow = getRefundWindowStatus(latestJoinOrder, latestJoinPayment);
  const refundApplied = refundWindow.refundable;
  const refundAmount = refundWindow.amountInFen;
  const now = new Date();
  let refundStatus = "";
  let refundRawPayload = null;

  if (refundApplied) {
    const refundRequest = await requestWechatRefundForOrder({
      order: latestJoinOrder,
      payment: latestJoinPayment,
      refundAmount,
      reason: "member_self_refund_and_quit",
    });
    refundStatus = refundRequest.refundStatus;
    refundRawPayload = refundRequest.extraPaymentRawPayload;
  }

  await prisma.$transaction(async (tx) => {
    if (refundApplied) {
      await applyRefundAndQuitMembership(tx, {
        groupId,
        userId: session.userId,
        membershipId: membership.id,
        membershipIsPaid: membership.isPaid,
        order: latestJoinOrder,
        payment: latestJoinPayment,
        refundAmount,
        now,
        reason: "member_self_refund_and_quit",
        extraPaymentRawPayload: refundRawPayload,
        markPaymentRefunded: refundStatus === "SUCCESS",
      });
      return;
    }

    await tx.groupStaff.updateMany({
      where: {
        groupId,
        userId: session.userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    await tx.groupNotificationSubscription.updateMany({
      where: {
        groupId,
        userId: session.userId,
      },
      data: {
        enabled: false,
      },
    });

    await tx.groupMember.update({
      where: {
        id: membership.id,
      },
      data: {
        status: "QUIT",
        expireAt: null,
        isPaid: membership.isPaid,
        lastActiveAt: now,
      },
    });

    await syncActiveMemberAggregates(tx, groupId);
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        groupId,
        membershipStatus: "QUIT",
        refunded: refundApplied && refundStatus === "SUCCESS",
        refundAmount,
        orderNo: refundApplied && latestJoinOrder ? latestJoinOrder.orderNo : "",
        refundStatus,
        idempotent: false,
      },
    },
  };
}

async function requestPlanetRefundReview(sessionToken, input = {}) {
  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;
  const groupId = String(input.groupId || "").trim();

  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const [group, membership] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        status: true,
        ownerUserId: true,
      },
    }),
    prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: session.userId,
        },
      },
    }),
  ]);

  if (!group || group.status === "CLOSED") {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在或已删除" } };
  }

  if (group.ownerUserId === session.userId) {
    return { statusCode: 400, payload: { ok: false, message: "星主无需通过此入口申请退款" } };
  }

  if (!membership || !membershipIsActive(membership)) {
    return { statusCode: 400, payload: { ok: false, message: "你当前不是有效成员" } };
  }

  const latestJoinOrder = await findLatestJoinOrderWithPayment(prisma, groupId, session.userId);
  const latestJoinPayment =
    latestJoinOrder && latestJoinOrder.paymentRecords && latestJoinOrder.paymentRecords.length
      ? latestJoinOrder.paymentRecords[0]
      : null;

  if (!latestJoinOrder || !latestJoinPayment) {
    return { statusCode: 404, payload: { ok: false, message: "未找到可退款的加入订单" } };
  }

  if (latestJoinOrder.paymentStatus === "REFUNDED" || latestJoinPayment.status === "REFUNDED") {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          groupId,
          orderNo: latestJoinOrder.orderNo,
          refundReviewStatus: "APPROVED",
          refundAmount: toFenAmount(latestJoinOrder.amount),
          submittedAt: "",
          idempotent: true,
        },
      },
    };
  }

  const refundReviewInfo = parseRefundReviewInfo(latestJoinPayment);
  if (refundReviewInfo.reviewStatus === "PENDING") {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          groupId,
          orderNo: latestJoinOrder.orderNo,
          refundReviewStatus: "PENDING",
          refundAmount: toFenAmount(latestJoinOrder.amount),
          submittedAt: refundReviewInfo.submittedAt,
          idempotent: true,
        },
      },
    };
  }

  const refundWindow = getRefundWindowStatus(latestJoinOrder, latestJoinPayment);
  if (!refundWindow.refundable) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: refundWindow.reason || "当前不在可退款范围内",
      },
    };
  }

  const requestedAt = new Date();
  const nextRawPayload = buildRefundReviewRawPayload(latestJoinPayment, {
    refundReviewRequired: true,
    refundReviewStatus: "PENDING",
    refundReviewReason: "",
    refundRequestedAt: requestedAt.toISOString(),
    refundReviewedAt: "",
    refundReviewerUserId: "",
  });

  await prisma.$transaction(async (tx) => {
    await tx.paymentRecord.update({
      where: { id: latestJoinPayment.id },
      data: {
        rawPayload: nextRawPayload,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: latestJoinOrder.id,
        fromStatus: latestJoinOrder.status,
        toStatus: latestJoinOrder.status,
        reason: "refund_review_pending",
        payload: {
          groupId,
          userId: session.userId,
          refundAmount: refundWindow.amountInFen,
        },
      },
    });
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        groupId,
        orderNo: latestJoinOrder.orderNo,
        refundReviewStatus: "PENDING",
        refundAmount: refundWindow.amountInFen,
        submittedAt: requestedAt.toISOString(),
        idempotent: false,
      },
    },
  };
}

async function reviewPlanetRefundRequest(sessionToken, input = {}) {
  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;
  const groupId = String(input.groupId || "").trim();
  const orderNo = String(input.orderNo || "").trim();
  const action = String(input.action || "").trim().toUpperCase();
  const reviewReason = String(input.reviewReason || "").trim();

  if (!groupId || !orderNo) {
    return { statusCode: 400, payload: { ok: false, message: "缺少退款审批所需参数" } };
  }

  if (action !== "APPROVE" && action !== "REJECT") {
    return { statusCode: 400, payload: { ok: false, message: "不支持的审批操作" } };
  }

  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: {
      group: true,
      paymentRecords: {
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
  });

  if (!order || order.groupId !== groupId || order.type !== "GROUP_JOIN") {
    return { statusCode: 404, payload: { ok: false, message: "退款申请不存在" } };
  }

  if (!order.group || order.group.ownerUserId !== session.userId) {
    return { statusCode: 403, payload: { ok: false, message: "只有星主可以审批退款申请" } };
  }

  const payment = order.paymentRecords && order.paymentRecords.length ? order.paymentRecords[0] : null;
  if (!payment || (payment.status !== "PAID" && payment.status !== "REFUNDED")) {
    return { statusCode: 400, payload: { ok: false, message: "当前订单支付状态不支持退款审批" } };
  }

  const refundReviewInfo = parseRefundReviewInfo(payment);
  if (action === "APPROVE" && (order.paymentStatus === "REFUNDED" || payment.status === "REFUNDED")) {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          action,
          groupId,
          orderNo,
          refunded: true,
          refundReviewStatus: "APPROVED",
          idempotent: true,
        },
      },
    };
  }

  if (refundReviewInfo.reviewStatus !== "PENDING") {
    if (action === "REJECT" && refundReviewInfo.reviewStatus === "REJECTED") {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          data: {
            action,
            groupId,
            orderNo,
            refunded: false,
            refundReviewStatus: "REJECTED",
            idempotent: true,
          },
        },
      };
    }

    return { statusCode: 400, payload: { ok: false, message: "当前没有待审批的退款申请" } };
  }

  const membership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: order.userId,
      },
    },
  });

  const reviewedAt = new Date();
  const nextReviewStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
  const nextRawPayload = buildRefundReviewRawPayload(payment, {
    refundReviewRequired: true,
    refundReviewStatus: nextReviewStatus,
    refundReviewReason: action === "REJECT" ? reviewReason || "星主已驳回退款申请" : "",
    refundRequestedAt: refundReviewInfo.submittedAt || reviewedAt.toISOString(),
    refundReviewedAt: reviewedAt.toISOString(),
    refundReviewerUserId: session.userId,
  });

  if (action === "REJECT") {
    await prisma.$transaction(async (tx) => {
      await tx.paymentRecord.update({
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
          reason: "refund_review_rejected",
          payload: {
            reviewReason: nextRawPayload.refundReviewReason,
            reviewerUserId: session.userId,
          },
        },
      });
    });

    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          action,
          groupId,
          orderNo,
          refunded: false,
          refundReviewStatus: "REJECTED",
          idempotent: false,
        },
      },
    };
  }

  if (!membership || !membershipIsActive(membership)) {
    return { statusCode: 409, payload: { ok: false, message: "该成员当前不再是有效成员，不能继续退款审批" } };
  }

  const refundRequest = await requestWechatRefundForOrder({
    order,
    payment,
    refundAmount: toFenAmount(order.amount),
    reason: "refund_review_approved",
  });

  await prisma.$transaction(async (tx) => {
    await applyRefundAndQuitMembership(tx, {
      groupId,
      userId: order.userId,
      membershipId: membership.id,
      membershipIsPaid: membership.isPaid,
      order,
      payment,
      refundAmount: toFenAmount(order.amount),
      now: reviewedAt,
      reason: "refund_review_approved",
      extraPaymentRawPayload: {
        ...nextRawPayload,
        ...(refundRequest.extraPaymentRawPayload || {}),
      },
      markPaymentRefunded: refundRequest.refundStatus === "SUCCESS",
    });
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
          action,
          groupId,
          orderNo,
          refunded: refundRequest.refundStatus === "SUCCESS",
          refundStatus: refundRequest.refundStatus,
          refundReviewStatus: "APPROVED",
          idempotent: false,
        },
    },
  };
}

async function getRefundApprovalDashboard(sessionToken) {
  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;

  const [createdOrders, joinedOrders, activeMemberships] = await Promise.all([
    prisma.order.findMany({
      where: {
        type: "GROUP_JOIN",
        group: {
          ownerUserId: session.userId,
          status: { in: ["ACTIVE", "HIDDEN"] },
        },
      },
      include: {
        group: true,
        user: {
          include: {
            profile: true,
          },
        },
        paymentRecords: {
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.order.findMany({
      where: {
        type: "GROUP_JOIN",
        userId: session.userId,
      },
      include: {
        group: {
          include: {
            owner: {
              include: {
                profile: true,
              },
            },
          },
        },
        paymentRecords: {
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.groupMember.findMany({
      where: {
        userId: session.userId,
        status: "ACTIVE",
      },
    }),
  ]);

  const createdItems = createdOrders
    .map((order) => {
      const payment = order.paymentRecords && order.paymentRecords.length ? order.paymentRecords[0] : null;
      if (!payment || parseRefundReviewInfo(payment).reviewStatus !== "PENDING") {
        return null;
      }
      return buildCreatorRefundApprovalItem(order, payment);
    })
    .filter(Boolean)
    .sort((left, right) => String(right.requestedAt || "").localeCompare(String(left.requestedAt || "")));

  const activeMembershipMap = new Map(activeMemberships.map((membership) => [`${membership.groupId}:${membership.userId}`, membership]));
  const joinedOrderMap = new Map();
  joinedOrders.forEach((order) => {
    const key = String(order.groupId || order.id);
    if (!joinedOrderMap.has(key)) {
      joinedOrderMap.set(key, order);
    }
  });

  const joinedItems = Array.from(joinedOrderMap.values())
    .map((order) => {
      const payment = order.paymentRecords && order.paymentRecords.length ? order.paymentRecords[0] : null;
      if (!order.group || !payment || toFenAmount(order.amount) <= 0) {
        return null;
      }
      const membership = activeMembershipMap.get(`${order.groupId}:${order.userId}`) || null;
      const item = buildJoinedRefundStatusItem(order, payment, membership);
      if (item.status === "NONE") {
        return null;
      }
      return item;
    })
    .filter(Boolean)
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        created: {
          pendingCount: createdItems.length,
          items: createdItems,
        },
        joined: {
          actionableCount: joinedItems.filter((item) => item.actionable).length,
          pendingCount: joinedItems.filter((item) => item.status === "PENDING").length,
          items: joinedItems,
        },
      },
    },
  };
}

async function getPlanetRefundManagement(sessionToken, input = {}) {
  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;
  const groupId = String(input.groupId || "").trim();

  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      owner: {
        include: {
          profile: true,
        },
      },
    },
  });

  if (!group || group.status === "CLOSED") {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在或已删除" } };
  }

  if (group.ownerUserId !== session.userId) {
    return { statusCode: 403, payload: { ok: false, message: "只有星主可以查看退款管理" } };
  }

  const memberships = await prisma.groupMember.findMany({
    where: {
      groupId,
      status: "ACTIVE",
      userId: {
        not: session.userId,
      },
    },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
    },
    orderBy: [{ joinedAt: "desc" }, { createdAt: "desc" }],
  });

  const memberUserIds = memberships.map((membership) => membership.userId);
  const orders = memberUserIds.length
    ? await prisma.order.findMany({
        where: {
          groupId,
          type: "GROUP_JOIN",
          userId: {
            in: memberUserIds,
          },
        },
        include: {
          paymentRecords: {
            orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
            take: 1,
          },
        },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      })
    : [];

  const latestOrderByUserId = new Map();
  orders.forEach((order) => {
    if (!latestOrderByUserId.has(order.userId)) {
      latestOrderByUserId.set(order.userId, order);
    }
  });

  const now = new Date();
  const items = memberships
    .map((membership) => {
      const order = latestOrderByUserId.get(membership.userId) || null;
      const payment = order && order.paymentRecords && order.paymentRecords.length ? order.paymentRecords[0] : null;
      return buildRefundManagementMemberItem(membership, order, payment, now);
    })
    .sort((left, right) => {
      if (left.canRefund && !right.canRefund) {
        return -1;
      }
      if (!left.canRefund && right.canRefund) {
        return 1;
      }
      return String(right.joinedAt || "").localeCompare(String(left.joinedAt || ""));
    });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          ownerName: group.owner && group.owner.profile && group.owner.profile.nickname ? group.owner.profile.nickname : "星主",
          priceAmount: Number(group.priceAmount || 0),
          priceLabel: group.joinType === "FREE" ? "免费加入" : `¥ ${group.priceAmount}/年`,
          memberCount: group.memberCount,
          refundWindowHours: SELF_REFUND_WINDOW_HOURS,
        },
        summary: {
          totalMembers: items.length,
          refundableMembers: items.filter((item) => item.canRefund).length,
          expiredMembers: items.filter((item) => item.isPaid && !item.canRefund).length,
        },
        items,
      },
    },
  };
}

async function refundPlanetMemberByOwner(sessionToken, input = {}) {
  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;
  const groupId = String(input.groupId || "").trim();
  const memberUserId = String(input.memberUserId || "").trim();

  if (!groupId || !memberUserId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID或成员ID" } };
  }

  const [group, membership] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        status: true,
        ownerUserId: true,
      },
    }),
    prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: memberUserId,
        },
      },
    }),
  ]);

  if (!group || group.status === "CLOSED") {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在或已删除" } };
  }

  if (group.ownerUserId !== session.userId) {
    return { statusCode: 403, payload: { ok: false, message: "只有星主可以发起退款" } };
  }

  if (memberUserId === session.userId) {
    return { statusCode: 400, payload: { ok: false, message: "请使用成员侧入口处理自己的退款退出" } };
  }

  if (!membership || membership.status !== "ACTIVE") {
    return { statusCode: 400, payload: { ok: false, message: "该成员当前不可退款" } };
  }

  const latestJoinOrder = await findLatestJoinOrderWithPayment(prisma, groupId, memberUserId);
  const latestJoinPayment =
    latestJoinOrder && latestJoinOrder.paymentRecords && latestJoinOrder.paymentRecords.length
      ? latestJoinOrder.paymentRecords[0]
      : null;
  const refundWindow = getRefundWindowStatus(latestJoinOrder, latestJoinPayment);

  if (!refundWindow.refundable) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: refundWindow.reason || "当前成员不在可退款范围内",
      },
    };
  }

  const now = new Date();
  const refundRequest = await requestWechatRefundForOrder({
    order: latestJoinOrder,
    payment: latestJoinPayment,
    refundAmount: refundWindow.amountInFen,
    reason: "owner_refund_member_and_remove",
  });

  await prisma.$transaction(async (tx) => {
    await applyRefundAndQuitMembership(tx, {
      groupId,
      userId: memberUserId,
      membershipId: membership.id,
      membershipIsPaid: membership.isPaid,
      order: latestJoinOrder,
      payment: latestJoinPayment,
      refundAmount: refundWindow.amountInFen,
      now,
      reason: "owner_refund_member_and_remove",
      extraPaymentRawPayload: refundRequest.extraPaymentRawPayload,
      markPaymentRefunded: refundRequest.refundStatus === "SUCCESS",
    });
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        groupId,
        memberUserId,
        membershipStatus: "QUIT",
        refunded: refundRequest.refundStatus === "SUCCESS",
        refundAmount: refundWindow.amountInFen,
        orderNo: latestJoinOrder ? latestJoinOrder.orderNo : "",
        refundStatus: refundRequest.refundStatus,
        idempotent: false,
      },
    },
  };
}

async function repairMissingWechatRefundByOrderNo(orderNo) {
  const normalizedOrderNo = String(orderNo || "").trim();

  if (!normalizedOrderNo) {
    throw new Error("缺少订单号");
  }

  const order = await prisma.order.findUnique({
    where: { orderNo: normalizedOrderNo },
    include: {
      paymentRecords: {
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
  });

  if (!order) {
    throw new Error("订单不存在");
  }

  const payment = order.paymentRecords && order.paymentRecords.length ? order.paymentRecords[0] : null;
  if (!payment) {
    throw new Error("支付记录不存在");
  }

  if (order.type !== "GROUP_JOIN") {
    throw new Error("当前只支持修复加入星球订单的退款");
  }

  if (Math.round(Number(order.amount || 0) * 100) <= 0) {
    throw new Error("当前订单金额为 0，无需补退");
  }

  const refundInfo = parseWechatRefundInfo(payment);
  let refundResult;

  if (refundInfo.outRefundNo) {
    refundResult = await queryDomesticRefundByOutRefundNo({
      outRefundNo: refundInfo.outRefundNo,
    });
  } else {
    refundResult = await requestWechatRefundForOrder({
      order,
      payment,
      refundAmount: toFenAmount(order.amount),
      reason: "repair_missing_wechat_refund",
    });
    refundResult = {
      refundId: refundResult.refundResult.refundId,
      outRefundNo: refundResult.refundResult.outRefundNo,
      status: refundResult.refundStatus,
      userReceivedAccount: refundResult.refundResult.userReceivedAccount,
      rawResponse: refundResult.refundResult.rawResponse,
    };
  }

  const refundStatus = String(refundResult.status || "").trim().toUpperCase() || "PROCESSING";
  const now = new Date().toISOString();
  const nextRawPayload = buildRefundReviewRawPayload(payment, {
    wechatRefundOutNo: refundResult.outRefundNo || refundInfo.outRefundNo || buildWechatRefundOutNo(order, payment),
    wechatRefundId: refundResult.refundId || refundInfo.refundId || "",
    wechatRefundStatus: refundStatus,
    wechatRefundRequestedAt: refundInfo.requestedAt || now,
    wechatRefundSuccessAt: refundStatus === "SUCCESS" ? refundInfo.successAt || now : refundInfo.successAt || "",
    wechatRefundUserReceivedAccount: refundResult.userReceivedAccount || refundInfo.userReceivedAccount || "",
    wechatRefundReason: refundInfo.reason || "repair_missing_wechat_refund",
    wechatRefundRawResponse: refundResult.rawResponse || {},
  });

  await prisma.$transaction(async (tx) => {
    await tx.paymentRecord.update({
      where: { id: payment.id },
      data: {
        status: refundStatus === "SUCCESS" ? "REFUNDED" : payment.status,
        refundedAt: refundStatus === "SUCCESS" ? payment.refundedAt || new Date() : payment.refundedAt,
        rawPayload: nextRawPayload,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: refundStatus === "SUCCESS" ? "REFUNDED" : order.status,
        paymentStatus: refundStatus === "SUCCESS" ? "REFUNDED" : order.paymentStatus,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: refundStatus === "SUCCESS" ? "REFUNDED" : order.status,
        reason: "refund_repair_requested",
        payload: {
          wechatRefundOutNo: nextRawPayload.wechatRefundOutNo,
          wechatRefundStatus: refundStatus,
        },
      },
    });
  });

  return {
    orderNo: normalizedOrderNo,
    refundStatus,
    outRefundNo: nextRawPayload.wechatRefundOutNo,
    refundId: nextRawPayload.wechatRefundId,
  };
}

async function deletePlanetByOwner(sessionToken, input = {}) {
  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;
  const groupId = String(input.groupId || "").trim();

  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      status: true,
      joinType: true,
      ownerUserId: true,
    },
  });

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  if (group.ownerUserId !== session.userId) {
    return { statusCode: 403, payload: { ok: false, message: "只有球主可以删除星球" } };
  }

  if (group.status === "CLOSED") {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          groupId,
          status: group.status,
          deleted: true,
          idempotent: true,
        },
      },
    };
  }

  const now = new Date();
  const activeMemberCount = await prisma.groupMember.count({
    where: {
      groupId,
      status: "ACTIVE",
      OR: [{ expireAt: null }, { expireAt: { gt: now } }],
    },
  });
  const canDelete = group.joinType === "FREE" || activeMemberCount <= 1;

  if (!canDelete) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "仅免费星球或当前仅剩球主一人时可删除",
      },
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.group.update({
      where: { id: groupId },
      data: {
        status: "CLOSED",
        publishedAt: null,
        memberCount: 0,
        paidMemberCount: 0,
      },
    });

    await tx.groupPermissionPolicy.updateMany({
      where: { groupId },
      data: {
        allowJoin: false,
        allowPreview: false,
        allowSearch: false,
      },
    });

    await tx.groupStaff.updateMany({
      where: {
        groupId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    await tx.groupMember.updateMany({
      where: {
        groupId,
        status: {
          not: "QUIT",
        },
      },
      data: {
        status: "QUIT",
        expireAt: null,
      },
    });

    await tx.groupNotificationSubscription.updateMany({
      where: { groupId },
      data: {
        enabled: false,
      },
    });
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        groupId,
        status: "CLOSED",
        deleted: true,
        idempotent: false,
      },
    },
  };
}

async function createPlanet(sessionToken, input) {
  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;

  const { name, price, joinType } = input;

  if (!name || !name.trim()) {
    return { statusCode: 400, payload: { ok: false, message: "请输入星球名称" } };
  }

  if (name.trim().length > 15) {
    return { statusCode: 400, payload: { ok: false, message: "星球名称不能超过15字" } };
  }

  if (price === undefined || price === null || price < 0) {
    return { statusCode: 400, payload: { ok: false, message: "请输入有效的价格" } };
  }

  if (joinType && !["rolling", "calendar"].includes(joinType)) {
    return { statusCode: 400, payload: { ok: false, message: "加入类型参数无效" } };
  }

  const slug = generateSlug(name.trim());
  const isFree = price === 0;
  const joinTypeEnum = isFree ? "FREE" : "PAID";
  const billingPeriod = joinType === "calendar" ? "YEAR" : "YEAR";
  const renewalSettingCompatibility = isFree
    ? { canWrite: false, missingColumns: [] }
    : await getRenewalSettingWriteCompatibility();

  const group = await prisma.$transaction(async (tx) => {
    const ownerJoinedAt = new Date();
    const newGroup = await tx.group.create({
      data: {
        name: name.trim(),
        slug,
        ownerUserId: session.userId,
        joinType: joinTypeEnum,
        billingPeriod,
        priceAmount: price,
        originalPriceAmount: price,
        memberCount: 1,
        paidMemberCount: isFree ? 0 : 1,
        status: "ACTIVE",
        publishedAt: new Date(),
        permissionPolicy: {
          create: {},
        },
      },
      include: {
        permissionPolicy: true,
      },
    });

    if (!isFree && renewalSettingCompatibility.canWrite) {
      await tx.renewalSetting.create({
        data: buildDefaultRenewalSettingData(newGroup.id, price),
      });
    }

    await tx.groupMember.create({
      data: {
        groupId: newGroup.id,
        userId: session.userId,
        memberNo: 1,
        status: "ACTIVE",
        joinSource: "MANUAL",
        isPaid: !isFree,
        joinedAt: ownerJoinedAt,
        firstJoinedAt: ownerJoinedAt,
        expireAt: null,
        lastActiveAt: ownerJoinedAt,
      },
    });

    await tx.groupStaff.create({
      data: {
        groupId: newGroup.id,
        userId: session.userId,
        role: "OWNER",
        isActive: true,
      },
    });

    return newGroup;
  });

  const warning =
    !isFree && !renewalSettingCompatibility.canWrite
      ? `当前数据库 renewal_settings 表缺少字段：${renewalSettingCompatibility.missingColumns.join(
          ", "
        )}，已跳过默认续期配置初始化。请在 backend 目录执行 npm run db:push 后重启服务。`
      : "";

  if (warning) {
    console.warn(`[planet.create] ${warning}`);
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      warning,
      data: buildGroupProfile(group, session.user.profile, {
        joined: true,
      }),
    },
  };
}

async function updatePlanetProfile(sessionToken, input = {}) {
  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;
  const groupId = String(input.groupId || "").trim();

  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      owner: {
        include: {
          profile: true,
        },
      },
    },
  });

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  if (group.ownerUserId !== session.userId) {
    return { statusCode: 403, payload: { ok: false, message: "只有星主可以编辑星球资料" } };
  }

  const nextName = String(input.name || "").trim();
  const nextCategory = String(input.category || "").trim();
  const nextIntro = String(input.intro || "").trim();
  const nextAvatarImageUrl = String(input.avatarImageUrl || "").trim();

  if (!nextName) {
    return { statusCode: 400, payload: { ok: false, message: "请输入星球名称" } };
  }

  if (nextName.length > 24) {
    return { statusCode: 400, payload: { ok: false, message: "星球名称不能超过24个字" } };
  }

  if (nextCategory.length > 12) {
    return { statusCode: 400, payload: { ok: false, message: "分类标签不能超过12个字" } };
  }

  if (!nextIntro) {
    return { statusCode: 400, payload: { ok: false, message: "请输入星球简介" } };
  }

  if (nextIntro.length > 1000) {
    return { statusCode: 400, payload: { ok: false, message: "星球简介不能超过1000字" } };
  }

  const updatedGroup = await prisma.group.update({
    where: { id: groupId },
    data: {
      name: nextName,
      avatarUrl: nextAvatarImageUrl || null,
      description: nextCategory || null,
      intro: nextIntro,
      updatedAt: new Date(),
    },
    include: {
      owner: {
        include: {
          profile: true,
        },
      },
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildGroupProfile(updatedGroup, updatedGroup.owner?.profile, {
        joined: true,
      }),
    },
  };
}

async function getPlanetMembers(groupId, sessionToken) {
  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;

  const [group, viewerMembership, viewerStaff] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
    }),
    prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: session.userId,
        },
      },
    }),
    prisma.groupStaff.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: session.userId,
        },
      },
    }),
  ]);

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  const canView =
    group.ownerUserId === session.userId ||
    membershipIsActive(viewerMembership) ||
    Boolean(viewerStaff && viewerStaff.isActive);

  if (!canView) {
    return { statusCode: 403, payload: { ok: false, message: "暂无权限查看成员列表" } };
  }

  const [owner, staffs, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: group.ownerUserId },
      include: {
        profile: true,
      },
    }),
    prisma.groupStaff.findMany({
      where: {
        groupId,
        isActive: true,
        userId: {
          not: group.ownerUserId,
        },
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.groupMember.findMany({
      where: {
        groupId,
        status: "ACTIVE",
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [{ memberNo: "asc" }, { joinedAt: "asc" }],
    }),
  ]);

  const memberMap = new Map();

  if (owner) {
    memberMap.set(
      owner.id,
      buildGroupMemberListItem({
        id: "",
        userId: owner.id,
        memberNo: 1,
        status: "ACTIVE",
        isPaid: group.joinType !== "FREE",
        joinedAt: group.createdAt,
        expireAt: null,
        wechatNo: owner.profile && owner.profile.wechatNo ? owner.profile.wechatNo : "",
        isOwner: true,
        user: owner,
      })
    );
  }

  staffs.forEach((staff) => {
    if (!staff.user) {
      return;
    }

    const existing = memberMap.get(staff.userId);
    const nextItem = buildGroupMemberListItem({
      ...existing,
      id: existing && existing.memberId ? existing.memberId : "",
      userId: staff.userId,
      memberNo: existing && typeof existing.memberNo === "number" ? existing.memberNo : null,
      status: "ACTIVE",
      isPaid: existing ? existing.isPaid : false,
      joinedAt: existing && existing.joinedAt ? new Date(existing.joinedAt) : staff.createdAt,
      expireAt: existing && existing.expireAt ? new Date(existing.expireAt) : null,
      wechatNo: existing && existing.wechatNo ? existing.wechatNo : "",
      staffRole: staff.role,
      isOwner: false,
      user: staff.user,
    });
    memberMap.set(staff.userId, nextItem);
  });

  memberships.forEach((membership) => {
    const existing = memberMap.get(membership.userId);
    const nextItem = buildGroupMemberListItem({
      ...membership,
      staffRole: existing && existing.roleLabel ? undefined : undefined,
      isOwner: existing ? existing.isOwner : membership.userId === group.ownerUserId,
      user: membership.user,
    });

    if (existing) {
      memberMap.set(membership.userId, {
        ...existing,
        memberId: nextItem.memberId,
        memberNo: nextItem.memberNo,
        isPaid: nextItem.isPaid,
        status: nextItem.status,
        joinedAt: nextItem.joinedAt,
        expireAt: nextItem.expireAt,
        wechatNo: nextItem.wechatNo || existing.wechatNo,
      });
      return;
    }

    memberMap.set(membership.userId, nextItem);
  });

  const items = Array.from(memberMap.values()).sort((left, right) => {
    if (left.isOwner && !right.isOwner) {
      return -1;
    }
    if (!left.isOwner && right.isOwner) {
      return 1;
    }
    if (left.memberNo && right.memberNo) {
      return left.memberNo - right.memberNo;
    }
    if (left.memberNo && !right.memberNo) {
      return -1;
    }
    if (!left.memberNo && right.memberNo) {
      return 1;
    }
    return String(left.joinedAt || "").localeCompare(String(right.joinedAt || ""));
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        groupId,
        items,
      },
    },
  };
}

async function getMyPlanets(sessionToken) {
  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;

  const groups = await prisma.group.findMany({
    where: {
      ownerUserId: session.userId,
      status: { in: ["ACTIVE", "HIDDEN"] },
    },
    orderBy: { createdAt: "desc" },
  });

  const groupsWithProfile = groups.map((group) =>
    buildGroupProfile(group, session.user.profile, {
      joined: true,
    })
  );

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: groupsWithProfile,
    },
  };
}

async function getJoinedPlanets(sessionToken) {
  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;

  const memberships = await prisma.groupMember.findMany({
    where: {
      userId: session.userId,
      status: "ACTIVE",
    },
    include: {
      group: {
        include: {
          owner: {
            include: {
              profile: true,
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const joinedGroups = memberships
    .filter(
      (membership) =>
        membershipIsActive(membership) &&
        membership.group &&
        membership.group.ownerUserId !== session.userId
    )
    .map((membership) => {
      const latestRefundDeadline = membership.joinedAt ? buildRefundDeadline(membership.joinedAt) : null;
      const canRefundOnExit =
        Boolean(membership.isPaid) &&
        membership.joinedAt instanceof Date &&
        Date.now() - membership.joinedAt.getTime() <= SELF_REFUND_WINDOW_MS;

      return buildGroupProfile(membership.group, membership.group.owner?.profile, {
        joined: true,
        joinedAt: membership.joinedAt,
        isPaid: Boolean(membership.isPaid),
        canRefundOnExit,
        refundAmount: canRefundOnExit ? toFenAmount(membership.group.priceAmount) : 0,
        refundDeadline: latestRefundDeadline,
      });
    });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: joinedGroups,
    },
  };
}

async function getDiscoverPlanets(sessionToken, input = {}) {
  const limitValue = Number(input.limit || 12);
  const take = Number.isFinite(limitValue)
    ? Math.min(Math.max(Math.floor(limitValue), 1), 30)
    : 12;

  let sessionUserId = "";

  if (sessionToken) {
    const sessionResult = await getActiveSession(sessionToken);
    if (!sessionResult.error) {
      sessionUserId = sessionResult.session.userId;
    }
  }

  const activeMemberships = sessionUserId
    ? await prisma.groupMember.findMany({
        where: {
          userId: sessionUserId,
          status: "ACTIVE",
        },
        select: {
          groupId: true,
          status: true,
          expireAt: true,
        },
      })
    : [];

  const excludedGroupIds = activeMemberships
    .filter((membership) => membershipIsActive(membership))
    .map((membership) => membership.groupId);

  const where = {
    status: "ACTIVE",
    publishedAt: {
      not: null,
    },
    permissionPolicy: {
      is: {
        allowJoin: true,
        allowPreview: true,
        allowSearch: true,
      },
    },
  };

  if (sessionUserId) {
    where.ownerUserId = {
      not: sessionUserId,
    };
  }

  if (excludedGroupIds.length) {
    where.id = {
      notIn: excludedGroupIds,
    };
  }

  const groups = await prisma.group.findMany({
    where,
    include: {
      owner: {
        include: {
          profile: true,
        },
      },
    },
    orderBy: [{ memberCount: "desc" }, { publishedAt: "desc" }],
    take,
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: groups.map((group) => buildGroupProfile(group, group.owner.profile)),
    },
  };
}

module.exports = {
  createPlanet,
  updatePlanetProfile,
  leavePlanetMembership,
  requestPlanetRefundReview,
  repairMissingWechatRefundByOrderNo,
  reviewPlanetRefundRequest,
  getRefundApprovalDashboard,
  getPlanetRefundManagement,
  refundPlanetMemberByOwner,
  deletePlanetByOwner,
  getDiscoverPlanets,
  getJoinedPlanets,
  getMyPlanets,
  getPlanetMembers,
};
