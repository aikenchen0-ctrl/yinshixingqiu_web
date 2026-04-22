const { prisma } = require("../db/prisma");
const { buildArticlePayload } = require("./articleModelService");
const { createJsapiPayment } = require("./wechatPayService");

const ORDER_EXPIRY_MINUTES = 15;

function normalizeString(value) {
  return String(value || "").trim();
}

function toMoneyNumber(value) {
  return Number(value);
}

function nowPlusMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function resolveOrderUserId(sessionToken, inputUserId) {
  const normalizedSessionToken = normalizeString(sessionToken);
  const normalizedUserId = normalizeString(inputUserId);

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

function serializeUnlockSummary(unlock) {
  if (!unlock) {
    return null;
  }

  return {
    id: unlock.id,
    articleId: unlock.articleId,
    groupId: unlock.groupId,
    userId: unlock.userId,
    unlockedAt: unlock.unlockedAt,
    isUnlocked: true,
  };
}

async function createWechatPaymentRequest(input = {}) {
  const { order, payment, user, group, article } = input;

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
      payment,
      user,
      group,
      description: `解锁文章-${normalizeString((article && article.title) || (group && group.name) || "血饮文章")}`,
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
    } catch {}

    throw error;
  }
}

function extractArticleContextFromPayment(order, payment) {
  const rawPayload =
    payment && payment.rawPayload && typeof payment.rawPayload === "object" && !Array.isArray(payment.rawPayload)
      ? payment.rawPayload
      : {};

  return {
    articleId: normalizeString(rawPayload.articleId),
    groupId: normalizeString(rawPayload.groupId || order.groupId),
    articleTitle: normalizeString(rawPayload.articleTitle),
  };
}

async function loadExistingUnlock(articleId, userId, client = prisma) {
  const normalizedArticleId = normalizeString(articleId);
  const normalizedUserId = normalizeString(userId);
  if (!normalizedArticleId || !normalizedUserId) {
    return null;
  }

  return client.articleUnlock.findUnique({
    where: {
      articleId_userId: {
        articleId: normalizedArticleId,
        userId: normalizedUserId,
      },
    },
  });
}

async function createArticleUnlockOrder(input = {}) {
  const identityResult = await resolveOrderUserId(input.sessionToken, input.userId);
  if (!identityResult.ok) {
    return {
      statusCode: identityResult.statusCode,
      payload: {
        ok: false,
        message: identityResult.message,
      },
    };
  }

  const articleId = normalizeString(input.articleId);
  const resolvedUserId = identityResult.userId;
  const paymentChannel = normalizeString(input.paymentChannel) || "WECHAT";

  if (!articleId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少文章ID" } };
  }

  const [user, articlePost] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: resolvedUserId,
      },
    }),
    prisma.post.findUnique({
      where: {
        id: articleId,
      },
      include: {
        author: {
          include: {
            profile: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            coverUrl: true,
            ownerUserId: true,
            status: true,
          },
        },
      },
    }),
  ]);

  if (!user) {
    return { statusCode: 404, payload: { ok: false, message: "用户不存在" } };
  }

  if (!articlePost || articlePost.type !== "ARTICLE" || articlePost.status === "DELETED") {
    return { statusCode: 404, payload: { ok: false, message: "文章不存在" } };
  }

  if (!articlePost.group || articlePost.group.status === "CLOSED") {
    return { statusCode: 404, payload: { ok: false, message: "文章所属星球不存在" } };
  }

  if (articlePost.status !== "PUBLISHED") {
    return { statusCode: 400, payload: { ok: false, message: "当前文章暂不可解锁" } };
  }

  const article = buildArticlePayload(articlePost, {
    metadata: articlePost.metadata,
    group: articlePost.group,
    author: articlePost.author,
  });

  if (!article) {
    return { statusCode: 404, payload: { ok: false, message: "文章不存在" } };
  }

  if (article.access.accessType !== "paid") {
    return { statusCode: 409, payload: { ok: false, message: "当前文章无需付费解锁" } };
  }

  if (articlePost.authorUserId === resolvedUserId || articlePost.group.ownerUserId === resolvedUserId) {
    return { statusCode: 409, payload: { ok: false, message: "当前账号已可阅读全文" } };
  }

  const staffRecord = await prisma.groupStaff.findUnique({
    where: {
      groupId_userId: {
        groupId: articlePost.groupId,
        userId: resolvedUserId,
      },
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (staffRecord && staffRecord.isActive) {
    return { statusCode: 409, payload: { ok: false, message: "当前账号已可阅读全文" } };
  }

  const existingUnlock = await loadExistingUnlock(articleId, resolvedUserId);
  if (existingUnlock) {
    const existingOrder = await prisma.order.findUnique({
      where: {
        id: existingUnlock.orderId,
      },
    });
    const existingPayment = existingOrder
      ? await prisma.paymentRecord.findFirst({
          where: {
            orderId: existingOrder.id,
          },
        })
      : null;

    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          order: existingOrder
            ? serializeOrderSummary(existingOrder)
            : {
                id: "",
                orderNo: "",
                status: "PAID",
                amount: 0,
                discountAmount: 0,
                createdAt: existingUnlock.createdAt,
              },
          payment: existingPayment
            ? serializePaymentSummary(existingPayment, {
                required: false,
                request: null,
              })
            : {
                id: "",
                channel: paymentChannel,
                status: "PAID",
                required: false,
                request: null,
              },
          unlock: serializeUnlockSummary(existingUnlock),
          idempotent: true,
        },
      },
    };
  }

  const amount = Math.max(0, Math.round(Number(article.access.priceAmount || 0)));
  const orderNo = `ART${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNo,
        groupId: articlePost.groupId,
        userId: resolvedUserId,
        type: "ARTICLE_UNLOCK",
        status: "PENDING",
        paymentStatus: "UNPAID",
        amount,
        netAmount: 0,
        originalAmount: amount,
        discountAmount: 0,
        expireAt: nowPlusMinutes(ORDER_EXPIRY_MINUTES),
      },
    });

    const payment = await tx.paymentRecord.create({
      data: {
        orderId: order.id,
        channel: paymentChannel,
        status: "UNPAID",
        amount,
        rawPayload: {
          channel: paymentChannel,
          stage: "order_created",
          articleId: articlePost.id,
          articleTitle: article.title,
          groupId: articlePost.groupId,
          accessType: article.access.accessType,
          priceAmount: amount,
        },
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        toStatus: "PENDING",
        reason: "create_article_unlock_order",
        payload: {
          articleId: articlePost.id,
          groupId: articlePost.groupId,
          priceAmount: amount,
        },
      },
    });

    return { order, payment };
  });

  if (Math.round(amount * 100) <= 0) {
    const paymentResult = await applyArticleUnlockPaymentSuccess({
      order: result.order,
      payment: result.payment,
      transactionNo: `FREE_${orderNo}`,
      success: true,
    });

    if (paymentResult.statusCode !== 200 || !paymentResult.payload.ok) {
      return paymentResult;
    }

    return {
      statusCode: 201,
      payload: {
        ok: true,
        data: {
          order: {
            ...serializeOrderSummary(result.order),
            status: paymentResult.payload.data.order.status,
          },
          payment: {
            ...serializePaymentSummary(result.payment, {
              required: false,
              request: null,
            }),
            status: paymentResult.payload.data.payment.status,
          },
          unlock: paymentResult.payload.data.unlock || null,
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
      group: articlePost.group,
      article,
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
        unlock: null,
        idempotent: false,
      },
    },
  };
}

async function applyArticleUnlockPaymentSuccess(input = {}) {
  const order = input.order || null;
  const payment = input.payment || null;
  const success = input.success !== false;
  const normalizedTransactionNo =
    normalizeString(input.transactionNo) || normalizeString(payment && payment.transactionNo) || `ARTICLE_${Date.now()}`;

  if (!order || order.type !== "ARTICLE_UNLOCK") {
    return { statusCode: 400, payload: { ok: false, message: "不是文章解锁订单" } };
  }

  if (!payment) {
    return { statusCode: 404, payload: { ok: false, message: "支付记录不存在" } };
  }

  const context = extractArticleContextFromPayment(order, payment);
  if (!context.articleId || !context.groupId) {
    return { statusCode: 400, payload: { ok: false, message: "文章解锁订单缺少文章上下文" } };
  }

  if (payment.status === "PAID") {
    const existingUnlock = await loadExistingUnlock(context.articleId, order.userId);
    if (existingUnlock) {
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
            membership: null,
            unlock: serializeUnlockSummary(existingUnlock),
            idempotent: true,
          },
        },
      };
    }
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
          transactionNo: normalizedTransactionNo || payment.transactionNo,
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: "FAILED",
          reason: "article_unlock_payment_failed",
          payload: {
            articleId: context.articleId,
            transactionNo: normalizedTransactionNo || null,
          },
        },
      });

      return { order: failedOrder, payment: failedPayment, unlock: null, idempotent: false };
    }

    const articlePost = await tx.post.findUnique({
      where: {
        id: context.articleId,
      },
      select: {
        id: true,
        type: true,
        groupId: true,
      },
    });

    if (!articlePost || articlePost.type !== "ARTICLE") {
      throw new Error("文章不存在，无法完成解锁");
    }

    const paidAt = new Date();
    const paidOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentStatus: "PAID",
        paidAt,
      },
    });

    const paidPayment = await tx.paymentRecord.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        transactionNo: normalizedTransactionNo,
        paidAt,
        rawPayload: {
          ...(payment.rawPayload || {}),
          stage: "payment_success",
          paidAt: paidAt.toISOString(),
          articleId: articlePost.id,
          groupId: articlePost.groupId,
        },
      },
    });

    const unlock = await tx.articleUnlock.upsert({
      where: {
        articleId_userId: {
          articleId: articlePost.id,
          userId: order.userId,
        },
      },
      create: {
        articleId: articlePost.id,
        groupId: articlePost.groupId,
        userId: order.userId,
        orderId: order.id,
        unlockedAt: paidAt,
      },
      update: {
        groupId: articlePost.groupId,
        orderId: order.id,
        unlockedAt: paidAt,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "PAID",
        reason: "article_unlock_payment_success",
        payload: {
          articleId: articlePost.id,
          groupId: articlePost.groupId,
          transactionNo: normalizedTransactionNo,
        },
      },
    });

    return { order: paidOrder, payment: paidPayment, unlock, idempotent: false };
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
        membership: null,
        unlock: serializeUnlockSummary(result.unlock),
        idempotent: result.idempotent,
      },
    },
  };
}

module.exports = {
  createArticleUnlockOrder,
  applyArticleUnlockPaymentSuccess,
};
