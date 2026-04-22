const crypto = require("crypto");
const { prisma } = require("../db/prisma");
const {
  createJsapiPayment,
  queryJsapiPaymentOrderByOutTradeNo,
  requestDomesticRefund,
  queryDomesticRefundByOutRefundNo,
} = require("./wechatPayService");

const DEFAULT_GROUP_STATUSES = ["ACTIVE", "HIDDEN", "DRAFT"];
const DEFAULT_ADMIN_ORDER_LIMIT = 20;
const DEFAULT_MALL_SHARE_COMMISSION_RATE = 0.03;
const DEFAULT_MALL_SHARE_COMMISSION_MIN_AMOUNT = 0.5;
const DEFAULT_MALL_SHARE_COMMISSION_MAX_AMOUNT = 99;
const DEFAULT_MALL_ORDER_AUTO_CLOSE_MINUTES = 30;
const DEFAULT_MALL_ORDER_AUTO_CLOSE_INTERVAL_MS = 60 * 1000;
const DEFAULT_MALL_ORDER_AUTO_RECEIVE_DAYS = 7;
const DEFAULT_MALL_ORDER_AUTO_RECEIVE_INTERVAL_MS = 60 * 60 * 1000;
const MALL_SHARE_TOKEN_VERSION = 1;
const MALL_SHARE_SECRET_FALLBACK = "xueyin-mall-share-dev-secret";
const MALL_PUBLIC_STORE_ENV_KEYS = ["MALL_PUBLIC_STORE_ID", "MALL_PUBLIC_GROUP_ID", "MALL_GROUP_ID"];
const MALL_ADMIN_USER_ID_ENV_KEYS = ["MALL_ADMIN_USER_IDS", "MALL_ADMIN_USER_ID"];
const MALL_ADMIN_MOBILE_ENV_KEYS = ["MALL_ADMIN_MOBILES", "MALL_ADMIN_MOBILE"];
const WEB_BOSS_MOBILE_ENV_KEYS = ["WEB_BOSS_MOBILE", "WEB_ADMIN_BOSS_MOBILE"];
const DEFAULT_DEV_WEB_BOSS_MOBILE = "18888888888";
const DEMO_MALL_GROUP_IDS = new Set(["grp_datawhale_001"]);
const MALL_PRODUCT_DETAIL_IMAGE_TYPE_CAROUSEL = "CAROUSEL";
const MALL_PRODUCT_DETAIL_IMAGE_TYPE_PROMOTION = "PROMOTION";
const MALL_MEMBER_BENEFIT_NONE = "NONE";
const MALL_MEMBER_BENEFIT_MEMBER_PRICE = "MEMBER_PRICE";
const MALL_MEMBER_BENEFIT_MEMBER_EXCLUSIVE = "MEMBER_EXCLUSIVE";
const MALL_MEMBER_PRICE_KEYWORDS = ["会员价", "会员优惠"];
const MALL_MEMBER_EXCLUSIVE_KEYWORDS = ["会员专享", "会员专属", "会员限定"];
const MALL_COUPON_TYPE_PROMOTION = "PROMOTION";
const MALL_COUPON_META_PREFIX = "[[MALL_COUPON::";
const MALL_COUPON_META_SUFFIX = "::MALL_COUPON]]";
const MALL_PRICING_META_PREFIX = "[[MALL_PRICING::";
const MALL_PRICING_META_SUFFIX = "::MALL_PRICING]]";
const MALL_COUPON_STAGE_NEWCOMER = "NEWCOMER";
const MALL_COUPON_STAGE_FIRST_ORDER = "FIRST_ORDER";
const MALL_COUPON_STAGE_REPURCHASE = "REPURCHASE";
const MALL_COUPON_STAGE_GENERAL = "GENERAL";
const MALL_COUPON_STACKING_RULE_MEMBER_PRICE = "STACK_WITH_MEMBER_PRICE";
const MALL_COUPON_STAGE_LABEL_MAP = {
  [MALL_COUPON_STAGE_NEWCOMER]: "新人券",
  [MALL_COUPON_STAGE_FIRST_ORDER]: "首单券",
  [MALL_COUPON_STAGE_REPURCHASE]: "复购券",
  [MALL_COUPON_STAGE_GENERAL]: "通用券",
};
const MALL_COUPON_NAME_TAG_KEYWORDS = ["商城"];
const MALL_COUPON_CODE_TAG_KEYWORDS = ["MALL"];
const MALL_COUPON_NEWCOMER_KEYWORDS = ["新人", "新客", "NEW"];
const MALL_COUPON_FIRST_ORDER_KEYWORDS = ["首单", "首购", "FIRST"];
const MALL_COUPON_REPURCHASE_KEYWORDS = ["复购", "回购", "老客", "REBUY"];
const MALL_COUPON_GENERAL_KEYWORDS = ["通用", "全场", "GENERAL"];
const MAX_MALL_PRODUCT_CAROUSEL_IMAGES = 6;
const MAX_MALL_PRODUCT_PROMOTION_IMAGES = 30;
const MALL_ANALYTICS_EVENT_TYPES = new Set([
  "HOME_VIEW",
  "SEARCH_ENTRY_CLICK",
  "QUICK_ENTRY_CLICK",
  "MEMBER_ENTRANCE_CLICK",
  "MEMBER_OPEN_MEMBERSHIP_CLICK",
  "HERO_CLICK",
  "PRODUCT_CLICK",
  "MEMBER_PRODUCT_IMPRESSION",
  "MEMBER_EXCLUSIVE_INTERCEPT",
  "COUPON_IMPRESSION",
  "COUPON_AUTO_APPLY",
  "SEARCH_SUBMIT",
  "SEARCH_KEYWORD_CLICK",
  "SEARCH_RESULT_CLICK",
  "PRODUCT_DETAIL_VIEW",
  "ADD_TO_CART",
  "BUY_NOW_CLICK",
  "CHECKOUT_SUBMIT",
  "PAYMENT_START",
  "PAYMENT_SUCCESS",
  "PAYMENT_FAILURE",
  "PAYMENT_CANCEL",
]);
const MALL_ANALYTICS_TARGET_TYPES = new Set(["GROUP", "ORDER", "POST"]);
const DEFAULT_MALL_COUPON_ANALYTICS_DAYS = 30;
const MAX_MALL_COUPON_ANALYTICS_DAYS = 180;
const DEFAULT_MALL_COUPON_ANALYTICS_EVENT_LIMIT = 5000;
const DEFAULT_MALL_MEMBER_ZONE_PRODUCT_LIMIT = 60;
const MALL_MEMBER_ZONE_SORT_MODE_CONFIG_ORDER = "CONFIG_ORDER";
const MALL_MEMBER_ZONE_SORT_MODE_MEMBER_EXCLUSIVE_FIRST = "MEMBER_EXCLUSIVE_FIRST";
const MALL_MEMBER_ZONE_SORT_MODE_PRICE_ASC = "PRICE_ASC";
const MALL_MEMBER_ZONE_SORT_MODES = new Set([
  MALL_MEMBER_ZONE_SORT_MODE_CONFIG_ORDER,
  MALL_MEMBER_ZONE_SORT_MODE_MEMBER_EXCLUSIVE_FIRST,
  MALL_MEMBER_ZONE_SORT_MODE_PRICE_ASC,
]);
const MALL_COUPON_ANALYTICS_EVENT_TYPES = new Set([
  "COUPON_IMPRESSION",
  "COUPON_AUTO_APPLY",
  "CHECKOUT_SUBMIT",
  "PAYMENT_SUCCESS",
]);
const DEV_AUTH_MULTI_ACCOUNT =
  process.env.NODE_ENV !== "production" &&
  normalizeString(process.env.DEV_AUTH_MULTI_ACCOUNT || "1") !== "0";
let mallOrderAutoCloseTimer = null;
let mallOrderAutoReceiveTimer = null;
const mallDevIdentityRepairTasks = new Map();

function normalizeString(value) {
  return String(value || "").trim();
}

function readFirstEnvValue(envKeys, normalizer = normalizeString) {
  for (const envKey of envKeys) {
    const normalizedValue = normalizer(process.env[envKey]);
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return "";
}

function resolveWebBossMobile() {
  const configuredMobile = readFirstEnvValue(WEB_BOSS_MOBILE_ENV_KEYS, normalizePhone);
  if (configuredMobile) {
    return configuredMobile;
  }

  return process.env.NODE_ENV !== "production" ? DEFAULT_DEV_WEB_BOSS_MOBILE : "";
}

function isWebBossMallAdminSession(session) {
  const bossMobile = resolveWebBossMobile();
  if (!bossMobile || !session || !session.user) {
    return false;
  }

  return normalizePhone(session.user.mobile) === bossMobile;
}

function normalizeDevWechatIdentityValue(value) {
  return normalizeString(value).split("::")[0] || "";
}

function buildAnonymousDevWechatIdentityClauses(user) {
  if (!DEV_AUTH_MULTI_ACCOUNT || !user) {
    return [];
  }

  const rawOpenId = normalizeDevWechatIdentityValue(user.openId);
  const rawUnionId = normalizeDevWechatIdentityValue(user.unionId);

  return [
    rawOpenId
      ? {
          openId: `${rawOpenId}::`,
        }
      : null,
    rawUnionId
      ? {
          unionId: `${rawUnionId}::`,
        }
      : null,
  ].filter(Boolean);
}

async function findAnonymousMallDevUserBySessionUser(client, user) {
  const identityClauses = buildAnonymousDevWechatIdentityClauses(user);
  if (!identityClauses.length || !normalizeString(user.id)) {
    return null;
  }

  const candidates = await client.user.findMany({
    where: {
      id: {
        not: user.id,
      },
      OR: identityClauses,
    },
    orderBy: [{ lastLoginAt: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
    take: 1,
  });

  return candidates[0] || null;
}

async function migrateMallAddressesBetweenUsers(tx, fromUserId, toUserId) {
  const [sourceAddresses, targetDefaultAddress] = await Promise.all([
    tx.mallShippingAddress.findMany({
      where: {
        userId: fromUserId,
      },
      select: {
        id: true,
        isDefault: true,
      },
    }),
    tx.mallShippingAddress.findFirst({
      where: {
        userId: toUserId,
        isDefault: true,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!sourceAddresses.length) {
    return {
      movedCount: 0,
      clearedDefaultCount: 0,
    };
  }

  await tx.mallShippingAddress.updateMany({
    where: {
      userId: fromUserId,
    },
    data: {
      userId: toUserId,
    },
  });

  const movedDefaultAddressIds = targetDefaultAddress
    ? sourceAddresses.filter((item) => item.isDefault).map((item) => item.id)
    : [];
  const clearedDefaultResult = movedDefaultAddressIds.length
    ? await tx.mallShippingAddress.updateMany({
        where: {
          id: {
            in: movedDefaultAddressIds,
          },
        },
        data: {
          isDefault: false,
        },
      })
    : { count: 0 };

  return {
    movedCount: sourceAddresses.length,
    clearedDefaultCount: clearedDefaultResult.count,
  };
}

async function migrateMallCartItemsBetweenUsers(tx, fromUserId, toUserId) {
  const [sourceCartItems, targetCartItems] = await Promise.all([
    tx.mallCartItem.findMany({
      where: {
        userId: fromUserId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
    tx.mallCartItem.findMany({
      where: {
        userId: toUserId,
      },
    }),
  ]);

  if (!sourceCartItems.length) {
    return {
      movedCount: 0,
      mergedCount: 0,
    };
  }

  const targetCartItemByProductId = new Map(
    targetCartItems.map((item) => [normalizeString(item.productId), item])
  );

  let movedCount = 0;
  let mergedCount = 0;

  for (const sourceCartItem of sourceCartItems) {
    const productId = normalizeString(sourceCartItem.productId);
    const targetCartItem = targetCartItemByProductId.get(productId);

    if (!targetCartItem) {
      await tx.mallCartItem.update({
        where: {
          id: sourceCartItem.id,
        },
        data: {
          userId: toUserId,
        },
      });

      movedCount += 1;
      continue;
    }

    await tx.mallCartItem.update({
      where: {
        id: targetCartItem.id,
      },
      data: {
        quantity: normalizeInteger(
          Number(targetCartItem.quantity || 0) + Number(sourceCartItem.quantity || 0),
          {
            defaultValue: 1,
            min: 1,
            max: 99,
          }
        ),
      },
    });

    await tx.mallCartItem.delete({
      where: {
        id: sourceCartItem.id,
      },
    });

    mergedCount += 1;
  }

  return {
    movedCount,
    mergedCount,
  };
}

async function migrateMallReviewsBetweenUsers(tx, fromUserId, toUserId) {
  const [sourceReviews, targetReviews] = await Promise.all([
    tx.mallProductReview.findMany({
      where: {
        userId: fromUserId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
    tx.mallProductReview.findMany({
      where: {
        userId: toUserId,
      },
    }),
  ]);

  if (!sourceReviews.length) {
    return {
      movedCount: 0,
      mergedCount: 0,
    };
  }

  const targetReviewByProductId = new Map(
    targetReviews.map((item) => [normalizeString(item.productId), item])
  );

  let movedCount = 0;
  let mergedCount = 0;

  for (const sourceReview of sourceReviews) {
    const productId = normalizeString(sourceReview.productId);
    const targetReview = targetReviewByProductId.get(productId);

    if (!targetReview) {
      await tx.mallProductReview.update({
        where: {
          id: sourceReview.id,
        },
        data: {
          userId: toUserId,
        },
      });

      movedCount += 1;
      continue;
    }

    if (new Date(sourceReview.updatedAt).getTime() > new Date(targetReview.updatedAt).getTime()) {
      await tx.mallProductReview.update({
        where: {
          id: targetReview.id,
        },
        data: {
          rating: sourceReview.rating,
          content: sourceReview.content,
          isAnonymous: sourceReview.isAnonymous,
        },
      });
    }

    await tx.mallProductReview.delete({
      where: {
        id: sourceReview.id,
      },
    });

    mergedCount += 1;
  }

  return {
    movedCount,
    mergedCount,
  };
}

async function repairMallDevIdentityData(session) {
  if (!DEV_AUTH_MULTI_ACCOUNT || !session || !session.user) {
    return;
  }

  const currentUserId = normalizeString(session.userId);
  const currentUserMobile = normalizeString(session.user.mobile);
  if (!currentUserId || !currentUserMobile) {
    return;
  }

  const anonymousDevUser = await findAnonymousMallDevUserBySessionUser(prisma, session.user);
  if (!anonymousDevUser || !normalizeString(anonymousDevUser.id)) {
    return;
  }

  const taskKey = `${anonymousDevUser.id}->${currentUserId}`;
  const existingTask = mallDevIdentityRepairTasks.get(taskKey);
  if (existingTask) {
    await existingTask;
    return;
  }

  const repairTask = (async () => {
    const repairSummary = await prisma.$transaction(async (tx) => {
      const [
        ownedOrderResult,
        sharedOrderResult,
        addressSummary,
        cartSummary,
        reviewSummary,
      ] = await Promise.all([
        tx.mallOrder.updateMany({
          where: {
            userId: anonymousDevUser.id,
          },
          data: {
            userId: currentUserId,
          },
        }),
        tx.mallOrder.updateMany({
          where: {
            shareSharerUserId: anonymousDevUser.id,
          },
          data: {
            shareSharerUserId: currentUserId,
          },
        }),
        migrateMallAddressesBetweenUsers(tx, anonymousDevUser.id, currentUserId),
        migrateMallCartItemsBetweenUsers(tx, anonymousDevUser.id, currentUserId),
        migrateMallReviewsBetweenUsers(tx, anonymousDevUser.id, currentUserId),
      ]);

      return {
        ownedOrderCount: ownedOrderResult.count,
        sharedOrderCount: sharedOrderResult.count,
        addressSummary,
        cartSummary,
        reviewSummary,
      };
    });

    const repairedRecordCount =
      repairSummary.ownedOrderCount +
      repairSummary.sharedOrderCount +
      repairSummary.addressSummary.movedCount +
      repairSummary.cartSummary.movedCount +
      repairSummary.cartSummary.mergedCount +
      repairSummary.reviewSummary.movedCount +
      repairSummary.reviewSummary.mergedCount;

    if (repairedRecordCount > 0) {
      console.info("[mallService] repaired dev mall identity data", {
        fromUserId: anonymousDevUser.id,
        toUserId: currentUserId,
        ownedOrderCount: repairSummary.ownedOrderCount,
        sharedOrderCount: repairSummary.sharedOrderCount,
        addressMovedCount: repairSummary.addressSummary.movedCount,
        cartMovedCount: repairSummary.cartSummary.movedCount,
        cartMergedCount: repairSummary.cartSummary.mergedCount,
        reviewMovedCount: repairSummary.reviewSummary.movedCount,
        reviewMergedCount: repairSummary.reviewSummary.mergedCount,
      });
    }
  })();

  mallDevIdentityRepairTasks.set(taskKey, repairTask);

  try {
    await repairTask;
  } finally {
    mallDevIdentityRepairTasks.delete(taskKey);
  }
}

function resolveConfiguredMallStoreId() {
  for (const envKey of MALL_PUBLIC_STORE_ENV_KEYS) {
    const storeId = normalizeString(process.env[envKey]);
    if (storeId) {
      return storeId;
    }
  }

  return "";
}

function resolveMallStoreId(input = {}) {
  if (typeof input === "string") {
    return normalizeString(input);
  }

  return normalizeString(input.storeId || input.groupId);
}

function readNormalizedEnvSet(envKeys, normalizer = normalizeString) {
  return new Set(
    (Array.isArray(envKeys) ? envKeys : [])
      .flatMap((envKey) => String(process.env[envKey] || "").split(","))
      .map((value) => normalizer(value))
      .filter(Boolean)
  );
}

function normalizePhone(value) {
  return normalizeString(value).replace(/[^\d]/g, "");
}

function normalizeBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalizedValue)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalizedValue)) {
      return false;
    }
  }

  if (typeof value === "number") {
    return value > 0;
  }

  return defaultValue;
}

function normalizeInteger(value, options = {}) {
  const { defaultValue = 0, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = options;
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return defaultValue;
  }

  return Math.min(max, Math.max(min, Math.round(parsedValue)));
}

function normalizeMallProductDetailImageMediaType(value) {
  const normalizedValue = normalizeString(value).toUpperCase();
  if (normalizedValue === MALL_PRODUCT_DETAIL_IMAGE_TYPE_CAROUSEL) {
    return MALL_PRODUCT_DETAIL_IMAGE_TYPE_CAROUSEL;
  }

  return MALL_PRODUCT_DETAIL_IMAGE_TYPE_PROMOTION;
}

function normalizeMoneyNumber(value, options = {}) {
  const { defaultValue = 0, min = 0 } = options;
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return defaultValue;
  }

  const boundedValue = Math.max(min, parsedValue);
  return Math.round(boundedValue * 100) / 100;
}

function toMoneyNumber(value) {
  return Number(value || 0);
}

function resolveMallOrderAutoCloseMinutes() {
  return normalizeInteger(process.env.MALL_ORDER_AUTO_CLOSE_MINUTES, {
    defaultValue: DEFAULT_MALL_ORDER_AUTO_CLOSE_MINUTES,
    min: 1,
    max: 7 * 24 * 60,
  });
}

function resolveMallOrderAutoCloseIntervalMs() {
  return normalizeInteger(process.env.MALL_ORDER_AUTO_CLOSE_INTERVAL_MS, {
    defaultValue: DEFAULT_MALL_ORDER_AUTO_CLOSE_INTERVAL_MS,
    min: 10 * 1000,
    max: 60 * 60 * 1000,
  });
}

function resolveMallOrderAutoReceiveDays() {
  return normalizeInteger(process.env.MALL_ORDER_AUTO_RECEIVE_DAYS, {
    defaultValue: DEFAULT_MALL_ORDER_AUTO_RECEIVE_DAYS,
    min: 1,
    max: 60,
  });
}

function resolveMallOrderAutoReceiveIntervalMs() {
  return normalizeInteger(process.env.MALL_ORDER_AUTO_RECEIVE_INTERVAL_MS, {
    defaultValue: DEFAULT_MALL_ORDER_AUTO_RECEIVE_INTERVAL_MS,
    min: 60 * 1000,
    max: 24 * 60 * 60 * 1000,
  });
}

function getMallOrderExpireBefore(now = Date.now()) {
  return new Date(now - resolveMallOrderAutoCloseMinutes() * 60 * 1000);
}

function getMallOrderAutoReceiveBefore(now = Date.now()) {
  return new Date(now - resolveMallOrderAutoReceiveDays() * 24 * 60 * 60 * 1000);
}

function isMallOrderExpired(order, now = Date.now()) {
  if (!order || order.status !== "PENDING" || !order.createdAt) {
    return false;
  }

  return new Date(order.createdAt).getTime() <= getMallOrderExpireBefore(now).getTime();
}

function formatMoney(value) {
  return toMoneyNumber(value).toFixed(2);
}

function buildMallCouponStageLabel(stage) {
  return MALL_COUPON_STAGE_LABEL_MAP[stage] || MALL_COUPON_STAGE_LABEL_MAP[MALL_COUPON_STAGE_GENERAL];
}

function normalizeMallCouponStage(value) {
  const normalizedValue = normalizeString(value).toUpperCase();
  if (
    normalizedValue === MALL_COUPON_STAGE_NEWCOMER ||
    normalizedValue === MALL_COUPON_STAGE_FIRST_ORDER ||
    normalizedValue === MALL_COUPON_STAGE_REPURCHASE
  ) {
    return normalizedValue;
  }

  return MALL_COUPON_STAGE_GENERAL;
}

function buildMallCouponKeywordText(coupon) {
  const name = normalizeString(coupon && coupon.name);
  const code = normalizeString(coupon && coupon.code);

  return {
    raw: `${name} ${code}`.trim(),
    upper: `${name} ${code}`.trim().toUpperCase(),
  };
}

function hasMallCouponKeyword(keywordText, keywords) {
  const keywordList = Array.isArray(keywords) ? keywords : [];
  if (!keywordText || !keywordList.length) {
    return false;
  }

  return keywordList.some((keyword) => {
    const normalizedKeyword = normalizeString(keyword);
    if (!normalizedKeyword) {
      return false;
    }

    const expectUpper = normalizedKeyword === normalizedKeyword.toUpperCase();
    return expectUpper
      ? keywordText.upper.includes(normalizedKeyword)
      : keywordText.raw.includes(normalizedKeyword);
  });
}

function isMallPromotionCoupon(coupon) {
  if (!coupon) {
    return false;
  }

  const keywordText = buildMallCouponKeywordText(coupon);
  return (
    hasMallCouponKeyword(keywordText, MALL_COUPON_NAME_TAG_KEYWORDS) ||
    hasMallCouponKeyword(keywordText, MALL_COUPON_CODE_TAG_KEYWORDS)
  );
}

function resolveMallCouponStage(coupon) {
  const keywordText = buildMallCouponKeywordText(coupon);

  if (hasMallCouponKeyword(keywordText, MALL_COUPON_NEWCOMER_KEYWORDS)) {
    return MALL_COUPON_STAGE_NEWCOMER;
  }

  if (hasMallCouponKeyword(keywordText, MALL_COUPON_FIRST_ORDER_KEYWORDS)) {
    return MALL_COUPON_STAGE_FIRST_ORDER;
  }

  if (hasMallCouponKeyword(keywordText, MALL_COUPON_REPURCHASE_KEYWORDS)) {
    return MALL_COUPON_STAGE_REPURCHASE;
  }

  if (hasMallCouponKeyword(keywordText, MALL_COUPON_GENERAL_KEYWORDS)) {
    return MALL_COUPON_STAGE_GENERAL;
  }

  return MALL_COUPON_STAGE_GENERAL;
}

function resolveMallPromotionCoupon(coupon, groupId) {
  if (!coupon || coupon.groupId !== groupId) {
    return { coupon: null, message: "优惠券不可用" };
  }

  if (coupon.type !== MALL_COUPON_TYPE_PROMOTION) {
    return { coupon: null, message: "当前优惠券不支持商城结算" };
  }

  if (!isMallPromotionCoupon(coupon)) {
    return { coupon: null, message: "当前优惠券未接入商城使用规则" };
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

  if (toMoneyNumber(coupon.amount) <= 0) {
    return { coupon: null, message: "优惠券金额异常" };
  }

  return { coupon, message: "" };
}

function resolveMallCouponUserEligibility(coupon, mallPaidOrderCount) {
  const stage = resolveMallCouponStage(coupon);
  const paidOrderCount = normalizeInteger(mallPaidOrderCount, { defaultValue: 0, min: 0 });

  if (stage === MALL_COUPON_STAGE_NEWCOMER || stage === MALL_COUPON_STAGE_FIRST_ORDER) {
    return paidOrderCount <= 0
      ? { ok: true, message: "" }
      : { ok: false, message: "当前优惠券仅限商城首单用户使用" };
  }

  if (stage === MALL_COUPON_STAGE_REPURCHASE) {
    return paidOrderCount > 0
      ? { ok: true, message: "" }
      : { ok: false, message: "当前优惠券仅限商城复购用户使用" };
  }

  return { ok: true, message: "" };
}

function getMallCouponDiscountAmount(coupon, baseAmount) {
  if (!coupon) {
    return 0;
  }

  return normalizeMoneyNumber(Math.min(Math.max(toMoneyNumber(coupon.amount), 0), Math.max(toMoneyNumber(baseAmount), 0)));
}

function buildMallOrderCouponMeta(coupon, orderAmount) {
  if (!coupon) {
    return null;
  }

  const stage = resolveMallCouponStage(coupon);

  return {
    kind: "coupon",
    couponId: normalizeString(coupon.id),
    code: normalizeString(coupon.code),
    name: normalizeString(coupon.name),
    stage,
    stageLabel: buildMallCouponStageLabel(stage),
    discountAmount: getMallCouponDiscountAmount(coupon, orderAmount),
  };
}

function buildMallCouponStackingRuleText(memberDiscountAmount) {
  return toMoneyNumber(memberDiscountAmount) > 0
    ? "会员价商品可叠加商城券，优惠券按会员价后的订单金额计算"
    : "";
}

function buildMallOrderPricingMeta(input = {}) {
  const orderAmount = normalizeMoneyNumber(input.orderAmount, { defaultValue: 0, min: 0 });
  const fallbackPublicAmount = orderAmount + normalizeMoneyNumber(input.memberDiscountAmount, { defaultValue: 0, min: 0 });
  const publicAmount = Math.max(
    normalizeMoneyNumber(input.publicAmount, { defaultValue: fallbackPublicAmount, min: 0 }),
    orderAmount
  );
  const memberDiscountAmount = normalizeMoneyNumber(publicAmount - orderAmount, { defaultValue: 0, min: 0 });
  const couponDiscountAmount = normalizeMoneyNumber(input.couponDiscountAmount, { defaultValue: 0, min: 0 });
  const totalDiscountAmount = normalizeMoneyNumber(memberDiscountAmount + couponDiscountAmount, {
    defaultValue: 0,
    min: 0,
  });
  const couponStackingApplied = memberDiscountAmount > 0 && couponDiscountAmount > 0;
  const couponStackingRule = memberDiscountAmount > 0 ? MALL_COUPON_STACKING_RULE_MEMBER_PRICE : "";
  const couponStackingRuleText = buildMallCouponStackingRuleText(memberDiscountAmount);

  return {
    kind: "pricing",
    publicAmount,
    orderAmount,
    memberDiscountAmount,
    couponDiscountAmount,
    totalDiscountAmount,
    payableAmount: normalizeMoneyNumber(input.payableAmount, {
      defaultValue: Math.max(orderAmount - couponDiscountAmount, 0),
      min: 0,
    }),
    couponStackingApplied,
    couponStackingRule,
    couponStackingRuleText,
    memberPriceItemCount: normalizeInteger(input.memberPriceItemCount, { defaultValue: 0, min: 0 }),
    memberExclusiveItemCount: normalizeInteger(input.memberExclusiveItemCount, { defaultValue: 0, min: 0 }),
  };
}

function encodeMallCouponMeta(meta) {
  if (!meta || typeof meta !== "object") {
    return "";
  }

  return `${MALL_COUPON_META_PREFIX}${encodeBase64Url(JSON.stringify(meta))}${MALL_COUPON_META_SUFFIX}`;
}

function encodeMallPricingMeta(meta) {
  if (!meta || typeof meta !== "object") {
    return "";
  }

  return `${MALL_PRICING_META_PREFIX}${encodeBase64Url(JSON.stringify(meta))}${MALL_PRICING_META_SUFFIX}`;
}

function parseMallCouponMeta(value) {
  const encodedValue = normalizeString(value);
  if (!encodedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(decodeBase64Url(encodedValue));
    if (!parsedValue || parsedValue.kind !== "coupon") {
      return null;
    }

    return {
      kind: "coupon",
      couponId: normalizeString(parsedValue.couponId),
      code: normalizeString(parsedValue.code),
      name: normalizeString(parsedValue.name),
      stage: normalizeMallCouponStage(parsedValue.stage),
      stageLabel: normalizeString(parsedValue.stageLabel) || buildMallCouponStageLabel(parsedValue.stage),
      discountAmount: normalizeMoneyNumber(parsedValue.discountAmount, { defaultValue: 0, min: 0 }),
    };
  } catch (error) {
    return null;
  }
}

function parseMallPricingMeta(value) {
  const encodedValue = normalizeString(value);
  if (!encodedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(decodeBase64Url(encodedValue));
    if (!parsedValue || parsedValue.kind !== "pricing") {
      return null;
    }

    return buildMallOrderPricingMeta({
      publicAmount: parsedValue.publicAmount,
      orderAmount: parsedValue.orderAmount,
      memberDiscountAmount: parsedValue.memberDiscountAmount,
      couponDiscountAmount: parsedValue.couponDiscountAmount,
      payableAmount: parsedValue.payableAmount,
      memberPriceItemCount: parsedValue.memberPriceItemCount,
      memberExclusiveItemCount: parsedValue.memberExclusiveItemCount,
    });
  } catch (error) {
    return null;
  }
}

function buildMallOrderStoredRemark(remark, couponMeta, pricingMeta) {
  const buyerRemark = normalizeString(remark);
  const encodedCouponMeta = encodeMallCouponMeta(couponMeta);
  const encodedPricingMeta = encodeMallPricingMeta(pricingMeta);
  const metaLines = [encodedCouponMeta, encodedPricingMeta].filter(Boolean);

  if (!metaLines.length) {
    return buyerRemark;
  }

  return buyerRemark ? `${buyerRemark}\n${metaLines.join("\n")}` : metaLines.join("\n");
}

function parseMallOrderStoredRemark(value) {
  const rawRemark = String(value || "");
  const couponMetaPattern = new RegExp(
    `${MALL_COUPON_META_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([A-Za-z0-9\\-_]+)${MALL_COUPON_META_SUFFIX.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    )}`,
    "g"
  );
  const pricingMetaPattern = new RegExp(
    `${MALL_PRICING_META_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([A-Za-z0-9\\-_]+)${MALL_PRICING_META_SUFFIX.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    )}`,
    "g"
  );
  let parsedCouponMeta = null;
  let parsedPricingMeta = null;

  const buyerRemark = rawRemark
    .replace(couponMetaPattern, (_, encodedValue) => {
      const meta = parseMallCouponMeta(encodedValue);
      if (meta && !parsedCouponMeta) {
        parsedCouponMeta = meta;
      }
      return "";
    })
    .replace(pricingMetaPattern, (_, encodedValue) => {
      const meta = parseMallPricingMeta(encodedValue);
      if (meta && !parsedPricingMeta) {
        parsedPricingMeta = meta;
      }
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    buyerRemark,
    couponMeta: parsedCouponMeta,
    pricingMeta: parsedPricingMeta,
  };
}

function buildMallOrderPricingInspectionLevelLabel(level) {
  if (level === "OK") {
    return "优惠结构已校验";
  }

  if (level === "LEGACY") {
    return "历史订单兼容展示";
  }

  return "优惠结构待核对";
}

function createMallOrderPricingInspectionIssue(code, title, detail) {
  return {
    code,
    title,
    detail,
  };
}

function buildMallOrderPricingInspection(order, options = {}) {
  const couponMeta = options.couponMeta || null;
  const pricingMeta = options.pricingMeta || null;
  const orderAmount = normalizeMoneyNumber(options.orderAmount, { defaultValue: toMoneyNumber(order && order.totalAmount), min: 0 });
  const payableAmount = normalizeMoneyNumber(options.payableAmount, { defaultValue: toMoneyNumber(order && order.payableAmount), min: 0 });
  const couponDiscountAmount = normalizeMoneyNumber(options.couponDiscountAmount, { defaultValue: 0, min: 0 });
  const memberDiscountAmount = normalizeMoneyNumber(options.memberDiscountAmount, { defaultValue: 0, min: 0 });
  const totalDiscountAmount = normalizeMoneyNumber(options.totalDiscountAmount, {
    defaultValue: memberDiscountAmount + couponDiscountAmount,
    min: 0,
  });
  const memberPriceItemCount = pricingMeta ? normalizeInteger(pricingMeta.memberPriceItemCount, { defaultValue: 0, min: 0 }) : 0;
  const memberExclusiveItemCount = pricingMeta
    ? normalizeInteger(pricingMeta.memberExclusiveItemCount, { defaultValue: 0, min: 0 })
    : 0;
  const pricingMetaRuleText = pricingMeta ? normalizeString(pricingMeta.couponStackingRuleText) : "";
  const hasMeaningfulPricingMeta = Boolean(
    pricingMeta &&
      (normalizeMoneyNumber(pricingMeta.memberDiscountAmount, { defaultValue: 0, min: 0 }) > 0 ||
        normalizeMoneyNumber(pricingMeta.couponDiscountAmount, { defaultValue: 0, min: 0 }) > 0 ||
        Boolean(pricingMetaRuleText))
  );
  const issues = [];
  const hasDiscountStructure = Boolean(
    couponMeta || hasMeaningfulPricingMeta || couponDiscountAmount > 0 || memberDiscountAmount > 0 || totalDiscountAmount > 0
  );

  if (hasDiscountStructure) {
    if (!couponMeta && !pricingMeta && (couponDiscountAmount > 0 || memberDiscountAmount > 0 || totalDiscountAmount > 0)) {
      issues.push(
        createMallOrderPricingInspectionIssue(
          "LEGACY_DISCOUNT_STRUCTURE_MISSING",
          "旧订单缺少完整优惠结构",
          "这笔订单保留了优惠金额，但下单时没有写入完整的券与价格结构，当前页面会按保存下来的金额做保守还原。"
        )
      );
    }

    if (couponDiscountAmount > 0 && !couponMeta) {
      issues.push(
        createMallOrderPricingInspectionIssue(
          "COUPON_META_MISSING",
          "优惠券信息不完整",
          "订单里存在优惠券抵扣金额，但没有保存完整券信息，所以当前页面可能无法展示具体券名或阶段。"
        )
      );
    }

    if (memberDiscountAmount > 0 && !pricingMeta) {
      issues.push(
        createMallOrderPricingInspectionIssue(
          "PRICING_META_MISSING",
          "会员优惠拆分缺失",
          "订单里存在会员优惠金额，但没有保留完整价格结构，当前只按订单金额展示会员优惠。"
        )
      );
    }

    if (couponMeta && couponDiscountAmount <= 0) {
      issues.push(
        createMallOrderPricingInspectionIssue(
          "COUPON_DISCOUNT_MISSING",
          "券信息存在但抵扣金额缺失",
          "订单记录了优惠券信息，但抵扣金额未能正确还原，建议联调时优先核对支付成功与订单详情链路。"
        )
      );
    }

    if (pricingMeta && memberDiscountAmount > 0 && memberPriceItemCount <= 0 && memberExclusiveItemCount <= 0) {
      issues.push(
        createMallOrderPricingInspectionIssue(
          "MEMBER_ITEM_BREAKDOWN_MISSING",
          "会员商品拆分不完整",
          "订单里存在会员优惠，但没有记录会员价商品数量或会员专享商品数量，当前只能按订单级金额展示。"
        )
      );
    }

    const expectedPayableAmount = normalizeMoneyNumber(orderAmount - couponDiscountAmount, { defaultValue: orderAmount, min: 0 });
    if (Math.abs(expectedPayableAmount - payableAmount) >= 0.01) {
      issues.push(
        createMallOrderPricingInspectionIssue(
          "PAYABLE_AMOUNT_MISMATCH",
          "应付金额与优惠结构不一致",
          `按当前结构推算应付 ${formatMoney(expectedPayableAmount)}，但订单记录的是 ${formatMoney(payableAmount)}。`
        )
      );
    }

    const expectedTotalDiscountAmount = normalizeMoneyNumber(memberDiscountAmount + couponDiscountAmount, {
      defaultValue: memberDiscountAmount + couponDiscountAmount,
      min: 0,
    });
    if (Math.abs(expectedTotalDiscountAmount - totalDiscountAmount) >= 0.01) {
      issues.push(
        createMallOrderPricingInspectionIssue(
          "TOTAL_DISCOUNT_MISMATCH",
          "总优惠金额与拆分不一致",
          `当前总优惠记录为 ${formatMoney(totalDiscountAmount)}，但按会员优惠与券抵扣合计应为 ${formatMoney(expectedTotalDiscountAmount)}。`
        )
      );
    }

    if (pricingMeta && pricingMeta.couponStackingApplied && !pricingMetaRuleText) {
      issues.push(
        createMallOrderPricingInspectionIssue(
          "STACKING_RULE_TEXT_MISSING",
          "叠加规则说明缺失",
          "订单里记录了会员与优惠券叠加，但没有保留规则说明文本，当前页面无法完整解释优惠顺序。"
        )
      );
    }
  }

  const hasHighRiskIssue = issues.some((issue) =>
    ["LEGACY_DISCOUNT_STRUCTURE_MISSING", "PAYABLE_AMOUNT_MISMATCH", "TOTAL_DISCOUNT_MISMATCH"].includes(issue.code)
  );
  const level = !issues.length ? "OK" : hasHighRiskIssue ? "RISK" : "LEGACY";
  let summaryText = "";

  if (!hasDiscountStructure) {
    summaryText = "这笔订单没有使用会员优惠或商城券，当前金额展示为标准订单金额。";
  } else if (level === "OK") {
    summaryText = "这笔订单的会员优惠、优惠券抵扣和应付金额都能按结构化数据还原。";
  } else if (level === "LEGACY") {
    summaryText = "这笔订单包含历史兼容口径，当前页面按已保存金额做展示，部分优惠拆分信息可能不完整。";
  } else {
    summaryText = "这笔订单的优惠结构存在缺失或异常，当前页面已按保守口径展示，如需核对请联系商家。";
  }

  return {
    level,
    levelLabel: buildMallOrderPricingInspectionLevelLabel(level),
    shouldShowPrompt: hasDiscountStructure || issues.length > 0,
    hasCouponMeta: Boolean(couponMeta),
    hasPricingMeta: Boolean(pricingMeta),
    isLegacyCompatible: level !== "OK",
    issueCount: issues.length,
    summaryText,
    issues,
  };
}

async function getMallPaidOrderCountByClient(client, groupId, userId) {
  const normalizedGroupId = normalizeString(groupId);
  const normalizedUserId = normalizeString(userId);
  if (!normalizedGroupId || !normalizedUserId) {
    return 0;
  }

  return client.mallOrder.count({
    where: {
      groupId: normalizedGroupId,
      userId: normalizedUserId,
      status: "PAID",
    },
  });
}

async function listEligibleMallCouponsByClient(client, groupId, userId, options = {}) {
  const normalizedGroupId = normalizeString(groupId);
  const normalizedUserId = normalizeString(userId);
  if (!normalizedGroupId || !normalizedUserId) {
    return {
      items: [],
      mallPaidOrderCount: 0,
    };
  }

  const mallPaidOrderCount =
    options.mallPaidOrderCount === undefined
      ? await getMallPaidOrderCountByClient(client, normalizedGroupId, normalizedUserId)
      : normalizeInteger(options.mallPaidOrderCount, { defaultValue: 0, min: 0 });
  const coupons = await client.coupon.findMany({
    where: {
      groupId: normalizedGroupId,
      type: MALL_COUPON_TYPE_PROMOTION,
      status: "ACTIVE",
    },
    orderBy: [{ amount: "desc" }, { createdAt: "desc" }],
  });

  const items = coupons
    .map((coupon) => {
      const resolvedCoupon = resolveMallPromotionCoupon(coupon, normalizedGroupId);
      if (!resolvedCoupon.coupon) {
        return null;
      }

      const eligibility = resolveMallCouponUserEligibility(resolvedCoupon.coupon, mallPaidOrderCount);
      return eligibility.ok ? resolvedCoupon.coupon : null;
    })
    .filter(Boolean);

  return {
    items,
    mallPaidOrderCount,
  };
}

function pickBestMallCoupon(coupons, orderAmount, preferredCouponCode = "") {
  const couponList = Array.isArray(coupons) ? coupons.filter(Boolean) : [];
  const normalizedPreferredCouponCode = normalizeString(preferredCouponCode);
  const payableBaseAmount = normalizeMoneyNumber(orderAmount, { defaultValue: 0, min: 0 });

  if (!couponList.length || payableBaseAmount <= 0) {
    return {
      coupon: null,
      discountAmount: 0,
    };
  }

  if (normalizedPreferredCouponCode) {
    const matchedCoupon = couponList.find((coupon) => normalizeString(coupon.code) === normalizedPreferredCouponCode);
    return {
      coupon: matchedCoupon || null,
      discountAmount: matchedCoupon ? getMallCouponDiscountAmount(matchedCoupon, payableBaseAmount) : 0,
    };
  }

  return couponList.reduce(
    (bestResult, coupon) => {
      const discountAmount = getMallCouponDiscountAmount(coupon, payableBaseAmount);
      if (!bestResult.coupon) {
        return {
          coupon,
          discountAmount,
        };
      }

      if (discountAmount > bestResult.discountAmount) {
        return {
          coupon,
          discountAmount,
        };
      }

      if (discountAmount === bestResult.discountAmount) {
        const currentCouponAmount = toMoneyNumber(coupon.amount);
        const bestCouponAmount = toMoneyNumber(bestResult.coupon.amount);
        if (currentCouponAmount > bestCouponAmount) {
          return {
            coupon,
            discountAmount,
          };
        }

        if (
          currentCouponAmount === bestCouponAmount &&
          new Date(coupon.createdAt || 0).getTime() > new Date(bestResult.coupon.createdAt || 0).getTime()
        ) {
          return {
            coupon,
            discountAmount,
          };
        }
      }

      return bestResult;
    },
    { coupon: null, discountAmount: 0 }
  );
}

function serializeMallCoupon(coupon) {
  const amount = normalizeMoneyNumber(coupon.amount, { defaultValue: 0, min: 0 });
  const totalQuantity =
    coupon.totalQuantity === null || coupon.totalQuantity === undefined ? null : Number(coupon.totalQuantity);
  const remainingQuantity = totalQuantity === null ? null : Math.max(totalQuantity - Number(coupon.usedQuantity || 0), 0);
  const stage = resolveMallCouponStage(coupon);

  return {
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    amount,
    amountText: formatMoney(amount),
    totalQuantity,
    usedQuantity: Number(coupon.usedQuantity || 0),
    remainingQuantity,
    validFrom: toIso(coupon.validFrom),
    validTo: toIso(coupon.validTo),
    status: coupon.status,
    stage,
    stageLabel: buildMallCouponStageLabel(stage),
  };
}

async function consumeMallOrderCouponUsage(tx, order) {
  const remarkSummary = parseMallOrderStoredRemark(order && order.remark);
  const couponMeta = remarkSummary.couponMeta;
  const couponId = normalizeString(couponMeta && couponMeta.couponId);

  if (!couponId) {
    return false;
  }

  const updateResult = await tx.coupon.updateMany({
    where: {
      id: couponId,
    },
    data: {
      usedQuantity: {
        increment: 1,
      },
    },
  });

  return updateResult.count === 1;
}

function formatPercent(value) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "0%";
  }

  const percentage = Math.round(numericValue * 10000) / 100;
  if (Number.isInteger(percentage)) {
    return `${percentage.toFixed(0)}%`;
  }

  return `${percentage.toFixed(2).replace(/0+$/g, "").replace(/\.$/, "")}%`;
}

function toIso(value) {
  return value ? new Date(value).toISOString() : "";
}

function buildFallbackCoverText(title) {
  const normalizedTitle = normalizeString(title);
  return normalizedTitle ? normalizedTitle.slice(0, 2) : "商品";
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

function buildMallMembershipSummary(membership) {
  return {
    membershipActive: membershipIsActive(membership),
    membershipStatus: normalizeString(membership && membership.status),
    membershipExpireAt: toIso(membership && membership.expireAt),
    membershipIsPaid: Boolean(membership && membership.isPaid),
  };
}

async function getMallMembershipSummaryMap(groupIds, userId) {
  const normalizedUserId = normalizeString(userId);
  const normalizedGroupIds = Array.from(
    new Set(
      (Array.isArray(groupIds) ? groupIds : [])
        .map((groupId) => normalizeString(groupId))
        .filter(Boolean)
    )
  );

  if (!normalizedUserId || !normalizedGroupIds.length) {
    return new Map();
  }

  const memberships = await prisma.groupMember.findMany({
    where: {
      userId: normalizedUserId,
      groupId: {
        in: normalizedGroupIds,
      },
    },
    select: {
      groupId: true,
      status: true,
      expireAt: true,
      isPaid: true,
    },
  });

  return memberships.reduce((map, membership) => {
    map.set(normalizeString(membership.groupId), buildMallMembershipSummary(membership));
    return map;
  }, new Map());
}

function getMallMembershipSummaryByGroupId(membershipSummaryMap, groupId) {
  const normalizedGroupId = normalizeString(groupId);
  if (!normalizedGroupId || !(membershipSummaryMap instanceof Map)) {
    return buildMallMembershipSummary(null);
  }

  return membershipSummaryMap.get(normalizedGroupId) || buildMallMembershipSummary(null);
}

function containsAnyMallKeyword(sourceText, keywords) {
  const normalizedSourceText = normalizeString(sourceText);
  if (!normalizedSourceText) {
    return false;
  }

  return keywords.some((keyword) => normalizedSourceText.includes(keyword));
}

function resolveMallMemberBenefitType(product) {
  const keywordSource = `${normalizeString(product && product.title)}\n${normalizeString(product && product.subtitle)}`;
  if (containsAnyMallKeyword(keywordSource, MALL_MEMBER_EXCLUSIVE_KEYWORDS)) {
    return MALL_MEMBER_BENEFIT_MEMBER_EXCLUSIVE;
  }

  if (
    containsAnyMallKeyword(keywordSource, MALL_MEMBER_PRICE_KEYWORDS) &&
    toMoneyNumber(product && product.originalPrice) > toMoneyNumber(product && product.price)
  ) {
    return MALL_MEMBER_BENEFIT_MEMBER_PRICE;
  }

  return MALL_MEMBER_BENEFIT_NONE;
}

function buildMallMemberBenefitLabel(memberBenefitType) {
  if (memberBenefitType === MALL_MEMBER_BENEFIT_MEMBER_PRICE) {
    return "会员价";
  }

  if (memberBenefitType === MALL_MEMBER_BENEFIT_MEMBER_EXCLUSIVE) {
    return "会员专享";
  }

  return "";
}

function resolveMallProductBenefitState(product, options = {}) {
  const membershipSummary = options.membershipSummary || buildMallMembershipSummary(null);
  const resolveMembership = options.resolveMembership === true;
  const rawPrice = normalizeMoneyNumber(product && product.price, { defaultValue: 0, min: 0 });
  const rawOriginalPrice = normalizeMoneyNumber(product && product.originalPrice, { defaultValue: 0, min: 0 });
  const memberBenefitType = resolveMallMemberBenefitType(product);
  const membershipActive = Boolean(membershipSummary.membershipActive);

  const publicPrice =
    memberBenefitType === MALL_MEMBER_BENEFIT_MEMBER_PRICE && rawOriginalPrice > rawPrice ? rawOriginalPrice : rawPrice;
  const memberPrice = memberBenefitType === MALL_MEMBER_BENEFIT_MEMBER_PRICE ? rawPrice : 0;
  const effectivePrice = resolveMembership
    ? memberBenefitType === MALL_MEMBER_BENEFIT_MEMBER_PRICE
      ? membershipActive
        ? memberPrice
        : publicPrice
      : rawPrice
    : rawPrice;
  const effectiveOriginalPrice = resolveMembership
    ? memberBenefitType === MALL_MEMBER_BENEFIT_MEMBER_PRICE
      ? membershipActive && publicPrice > effectivePrice
        ? publicPrice
        : 0
      : rawOriginalPrice > effectivePrice
        ? rawOriginalPrice
        : 0
    : rawOriginalPrice;
  const canPurchase = resolveMembership
    ? memberBenefitType !== MALL_MEMBER_BENEFIT_MEMBER_EXCLUSIVE || membershipActive
    : true;

  let memberPromptText = "";
  if (memberBenefitType === MALL_MEMBER_BENEFIT_MEMBER_PRICE) {
    if (membershipActive && publicPrice > memberPrice) {
      memberPromptText = `会员已解锁，到手 ${formatMoney(memberPrice)}`;
    } else if (!membershipActive) {
      memberPromptText =
        publicPrice > memberPrice ? `开通会员后 ${formatMoney(memberPrice)}` : "开通会员后享专属价格";
    }
  } else if (memberBenefitType === MALL_MEMBER_BENEFIT_MEMBER_EXCLUSIVE) {
    memberPromptText = membershipActive ? "会员身份已解锁，可直接购买" : "开通会员后可购买";
  }

  return {
    memberBenefitType,
    memberBenefitLabel: buildMallMemberBenefitLabel(memberBenefitType),
    memberPrice,
    memberPriceText:
      memberBenefitType === MALL_MEMBER_BENEFIT_MEMBER_PRICE && memberPrice > 0 ? formatMoney(memberPrice) : "",
    publicPrice,
    publicPriceText: formatMoney(publicPrice),
    membershipActive,
    canPurchase,
    memberPromptText,
    effectivePrice,
    effectivePriceText: formatMoney(effectivePrice),
    effectiveOriginalPrice,
    effectiveOriginalPriceText:
      !resolveMembership || effectiveOriginalPrice > 0 ? formatMoney(effectiveOriginalPrice) : "",
  };
}

function buildMallMemberExclusivePurchaseError(product) {
  const productTitle = normalizeString(product && product.title) || "当前商品";
  return {
    statusCode: 403,
    payload: {
      ok: false,
      message: `商品「${productTitle}」为会员专享，开通会员后才能购买`,
    },
  };
}

function buildMallOrderStatusLabel(status) {
  const labelMap = {
    PENDING: "待支付",
    PAID: "已支付",
    CLOSED: "已关闭",
  };

  return labelMap[status] || "待支付";
}

function normalizeMallRefundStatus(value) {
  const normalizedValue = normalizeString(value).toUpperCase();
  return ["NONE", "PENDING", "REJECTED", "PROCESSING", "SUCCESS", "FAILED"].includes(normalizedValue)
    ? normalizedValue
    : "NONE";
}

function buildMallRefundStatusLabel(status) {
  const labelMap = {
    PENDING: "退款待审核",
    REJECTED: "退款被驳回",
    PROCESSING: "退款中",
    SUCCESS: "已退款",
    FAILED: "退款失败",
  };

  return labelMap[normalizeMallRefundStatus(status)] || "";
}

function buildMallPaymentStatus(order) {
  if (!order) {
    return "UNPAID";
  }

  const refundStatus = normalizeMallRefundStatus(order.refundStatus);
  if (refundStatus === "SUCCESS") {
    return "REFUNDED";
  }

  if (refundStatus === "PROCESSING") {
    return "REFUNDING";
  }

  if (order.status === "PAID") {
    return "PAID";
  }

  if (order.status === "CLOSED") {
    return "CLOSED";
  }

  return "UNPAID";
}

function buildMallPaymentStatusLabel(status) {
  const labelMap = {
    UNPAID: "待支付",
    PAID: "已支付",
    CLOSED: "已关闭",
    REFUNDING: "退款中",
    REFUNDED: "已退款",
  };

  return labelMap[normalizeString(status).toUpperCase()] || "待支付";
}

function normalizeMallShippingStatus(value) {
  const normalizedValue = normalizeString(value).toUpperCase();
  if (normalizedValue === "RECEIVED") {
    return "RECEIVED";
  }

  return normalizedValue === "SHIPPED" ? "SHIPPED" : "PENDING";
}

function buildMallShippingStatusLabel(order) {
  if (!order) {
    return "待发货";
  }

  const refundStatus = normalizeMallRefundStatus(order.refundStatus);
  if (refundStatus === "SUCCESS") {
    return "已退款";
  }

  if (refundStatus === "PROCESSING") {
    return "退款中";
  }

  if (refundStatus === "PENDING") {
    return "退款审核中";
  }

  if (refundStatus === "FAILED") {
    return "退款失败";
  }

  if (order.status === "CLOSED") {
    return "已关闭";
  }

  if (normalizeMallShippingStatus(order.shippingStatus) === "RECEIVED") {
    return "已收货";
  }

  if (normalizeMallShippingStatus(order.shippingStatus) === "SHIPPED") {
    return "已发货";
  }

  return order.status === "PAID" ? "待发货" : "待支付";
}

function buildMallShippingAddressFullAddress(input = {}) {
  return [
    normalizeString(input.province),
    normalizeString(input.city),
    normalizeString(input.district),
    normalizeString(input.detailAddress),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildMallCommissionStatusLabel(status) {
  const labelMap = {
    NONE: "未参与分销",
    PENDING: "待结算",
    CONFIRMED: "已结算",
    CANCELLED: "已失效",
  };

  return labelMap[status] || "未参与分销";
}

function canMallOrderRequestRefund(order) {
  return Boolean(
    order &&
      order.status === "PAID" &&
      normalizeMallShippingStatus(order.shippingStatus) === "PENDING" &&
      normalizeMallRefundStatus(order.refundStatus) === "NONE"
  );
}

function canMallOrderConfirmReceipt(order) {
  return Boolean(
    order &&
      order.status === "PAID" &&
      normalizeMallShippingStatus(order.shippingStatus) === "SHIPPED" &&
      ["NONE", "REJECTED", "FAILED"].includes(normalizeMallRefundStatus(order.refundStatus))
  );
}

function isMallOrderAutoReceivable(order, now = Date.now()) {
  if (!canMallOrderConfirmReceipt(order)) {
    return false;
  }

  const shippedAt = order.shippedAt || order.updatedAt;
  if (!shippedAt) {
    return false;
  }

  return new Date(shippedAt).getTime() <= getMallOrderAutoReceiveBefore(now).getTime();
}

function mapWechatRefundStatusToMallRefundStatus(status) {
  const normalizedStatus = normalizeString(status).toUpperCase();
  if (normalizedStatus === "SUCCESS") {
    return "SUCCESS";
  }

  if (normalizedStatus === "ABNORMAL" || normalizedStatus === "CLOSED") {
    return "FAILED";
  }

  return normalizedStatus === "PROCESSING" ? "PROCESSING" : "FAILED";
}

function buildMallRefundOutRefundNo(order) {
  const source = normalizeString(order && order.orderNo) || `mall_refund_${Date.now()}`;
  return `MR${source}`.slice(0, 64);
}

function buildMallShareCommissionUpdate(order, nextStatus) {
  if (!order) {
    return {};
  }

  const normalizedNextStatus = normalizeString(nextStatus).toUpperCase();
  if (!normalizeString(order.shareSharerUserId) || toMoneyNumber(order.shareCommissionAmount) <= 0) {
    return {};
  }

  if (normalizedNextStatus === "RECEIVED") {
    return {
      shareCommissionStatus: "CONFIRMED",
      shareCommissionSettledAt: new Date(),
    };
  }

  if (normalizedNextStatus === "CLOSED") {
    return {
      shareCommissionStatus: "CANCELLED",
      shareCommissionSettledAt: null,
    };
  }

  return {};
}

function normalizeMallOrderEditableStatus(value) {
  const normalizedValue = normalizeString(value).toUpperCase();
  return normalizedValue === "PENDING" || normalizedValue === "PAID" || normalizedValue === "CLOSED"
    ? normalizedValue
    : "";
}

function getMallShareSecret() {
  const configuredSecret = normalizeString(process.env.MALL_SHARE_SECRET || process.env.WECHAT_APP_SECRET);
  return configuredSecret || MALL_SHARE_SECRET_FALLBACK;
}

function encodeBase64Url(value) {
  return Buffer.from(String(value || ""), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalizedValue = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  if (!normalizedValue) {
    return "";
  }

  const padding = normalizedValue.length % 4 === 0 ? "" : "=".repeat(4 - (normalizedValue.length % 4));
  return Buffer.from(`${normalizedValue}${padding}`, "base64").toString("utf8");
}

function signMallSharePayload(encodedPayload) {
  return crypto
    .createHmac("sha256", getMallShareSecret())
    .update(String(encodedPayload || ""))
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function isMallShareSignatureEqual(actualSignature, expectedSignature) {
  const actualBuffer = Buffer.from(String(actualSignature || ""), "utf8");
  const expectedBuffer = Buffer.from(String(expectedSignature || ""), "utf8");

  if (!actualBuffer.length || actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function buildMallShareToken(input = {}) {
  const storeId = resolveMallStoreId(input);
  const payload = {
    v: MALL_SHARE_TOKEN_VERSION,
    s: storeId,
    p: normalizeString(input.productId),
    u: normalizeString(input.sharerUserId),
    t: Date.now(),
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signMallSharePayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseMallShareToken(token) {
  const normalizedToken = normalizeString(token);
  if (!normalizedToken) {
    return null;
  }

  const tokenSegments = normalizedToken.split(".");
  if (tokenSegments.length !== 2) {
    return null;
  }

  const encodedPayload = normalizeString(tokenSegments[0]);
  const signature = normalizeString(tokenSegments[1]);
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signMallSharePayload(encodedPayload);
  if (!isMallShareSignatureEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload));
    const version = Number(payload && payload.v);
    const storeId = normalizeString((payload && payload.s) || (payload && payload.g));
    const productId = normalizeString(payload && payload.p);
    const sharerUserId = normalizeString(payload && payload.u);

    if (version !== MALL_SHARE_TOKEN_VERSION || !storeId || !productId || !sharerUserId) {
      return null;
    }

    return {
      version,
      storeId,
      productId,
      sharerUserId,
      issuedAt: Number(payload && payload.t) || 0,
    };
  } catch (error) {
    return null;
  }
}

function calculateMallShareCommissionUnitAmount(price) {
  const amount = normalizeMoneyNumber(toMoneyNumber(price) * DEFAULT_MALL_SHARE_COMMISSION_RATE);
  return normalizeMoneyNumber(
    Math.min(Math.max(amount, DEFAULT_MALL_SHARE_COMMISSION_MIN_AMOUNT), DEFAULT_MALL_SHARE_COMMISSION_MAX_AMOUNT)
  );
}

function calculateMallShareCommissionAmount(price, quantity) {
  const safeQuantity = normalizeInteger(quantity, { defaultValue: 0, min: 0, max: 9999 });
  if (safeQuantity <= 0) {
    return 0;
  }

  return normalizeMoneyNumber(calculateMallShareCommissionUnitAmount(price) * safeQuantity);
}

async function getActiveSession(sessionToken) {
  const normalizedSessionToken = normalizeString(sessionToken);
  if (!normalizedSessionToken) {
    return null;
  }

  const session = await prisma.authSession.findUnique({
    where: { sessionToken: normalizedSessionToken },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
    },
  });

  if (!session || session.status !== "ACTIVE" || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return session;
}

async function hasMallFallbackAdminAccess(userId, storeIdInput) {
  const normalizedUserId = normalizeString(userId);
  if (!normalizedUserId) {
    return false;
  }

  const selection = await resolveMallGroupSelection(storeIdInput);
  if (!selection.groupId) {
    return false;
  }

  const mallStore = await prisma.group.findUnique({
    where: {
      id: selection.groupId,
    },
    select: {
      ownerUserId: true,
    },
  });

  return normalizeString(mallStore && mallStore.ownerUserId) === normalizedUserId;
}

async function authorizeMallAdminAccess(input = {}) {
  const session = await getActiveSession(input.sessionToken);
  if (!session) {
    return {
      statusCode: 401,
      payload: {
        ok: false,
        message: "请先登录商城后台后再操作",
      },
    };
  }

  if (isWebBossMallAdminSession(session)) {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          userId: session.userId,
          mobile: normalizeString(session.user && session.user.mobile),
          accessSource: "WEB_BOSS",
        },
      },
    };
  }

  const allowedUserIds = readNormalizedEnvSet(MALL_ADMIN_USER_ID_ENV_KEYS);
  const allowedMobiles = readNormalizedEnvSet(MALL_ADMIN_MOBILE_ENV_KEYS, normalizePhone);
  const hasExplicitAllowlist = allowedUserIds.size > 0 || allowedMobiles.size > 0;
  const currentMobile = normalizeString(session.user && session.user.mobile);
  const matchedAllowlist =
    allowedUserIds.has(normalizeString(session.userId)) ||
    (currentMobile ? allowedMobiles.has(normalizePhone(currentMobile)) : false);

  if (hasExplicitAllowlist && !matchedAllowlist) {
    return {
      statusCode: 403,
      payload: {
        ok: false,
        message: "当前账号没有商城后台权限",
      },
    };
  }

  if (!hasExplicitAllowlist && !(await hasMallFallbackAdminAccess(session.userId, input))) {
    return {
      statusCode: 403,
      payload: {
        ok: false,
        message: "当前账号没有商城后台权限",
      },
    };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        userId: session.userId,
        mobile: currentMobile,
        accessSource: hasExplicitAllowlist ? "ALLOWLIST" : "STORE_OWNER",
      },
    },
  };
}

async function requireMallSession(sessionToken) {
  const session = await getActiveSession(sessionToken);
  if (!session) {
    return {
      error: {
        statusCode: 401,
        payload: {
          ok: false,
          message: "请先登录后再操作",
        },
      },
    };
  }

  await repairMallDevIdentityData(session);

  return { session };
}

async function resolveMallGroup(groupId) {
  const selection = await resolveMallGroupSelection(groupId);

  if (!selection.groupId) {
    return {
      group: null,
      selection,
    };
  }

  return {
    group: await prisma.group.findUnique({
      where: { id: selection.groupId },
      select: {
        id: true,
        name: true,
        metadata: true,
        status: true,
      },
    }),
    selection,
  };
}

async function listMallCatalogGroupIds(limit = 2) {
  const productRows = await prisma.mallProduct.findMany({
    where: {
      isOnSale: true,
      category: {
        is: {
          isEnabled: true,
        },
      },
    },
    distinct: ["groupId"],
    select: {
      groupId: true,
    },
    take: limit,
  });

  const productGroupIds = productRows
    .map((row) => normalizeString(row.groupId))
    .filter(Boolean);

  if (productGroupIds.length) {
    return productGroupIds;
  }

  const categoryRows = await prisma.mallCategory.findMany({
    where: {
      isEnabled: true,
    },
    distinct: ["groupId"],
    select: {
      groupId: true,
    },
    take: limit,
  });

  return categoryRows
    .map((row) => normalizeString(row.groupId))
    .filter(Boolean);
}

function excludeDemoMallGroupIds(groupIds) {
  return groupIds.filter((groupId) => !DEMO_MALL_GROUP_IDS.has(normalizeString(groupId)));
}

async function resolveMallGroupSelection(groupId) {
  const normalizedStoreId = resolveMallStoreId(groupId);

  if (normalizedStoreId) {
    return {
      groupId: normalizedStoreId,
      storeId: normalizedStoreId,
      source: "REQUEST_STORE",
    };
  }

  const configuredStoreId = resolveConfiguredMallStoreId();
  if (configuredStoreId) {
    return {
      groupId: configuredStoreId,
      storeId: configuredStoreId,
      source: "ENV_CONFIG",
    };
  }

  const catalogGroupIds = await listMallCatalogGroupIds(3);
  const nonDemoCatalogGroupIds = excludeDemoMallGroupIds(catalogGroupIds);

  if (nonDemoCatalogGroupIds.length === 1) {
    return {
      groupId: nonDemoCatalogGroupIds[0],
      storeId: nonDemoCatalogGroupIds[0],
      source: "NON_DEMO_CATALOG_SINGLETON",
    };
  }

  if (catalogGroupIds.length === 1) {
    return {
      groupId: catalogGroupIds[0],
      storeId: catalogGroupIds[0],
      source: "CATALOG_SINGLETON",
    };
  }

  return {
    groupId: "",
    storeId: "",
    source: catalogGroupIds.length > 1 ? "AMBIGUOUS_CATALOG" : "UNBOUND",
  };
}

function buildMallGroupResolutionError(selection) {
  if (selection && selection.source === "AMBIGUOUS_CATALOG") {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: "商城存在多个可用数据源，请指定当前公开商城",
      },
    };
  }

  return {
    statusCode: 404,
    payload: {
      ok: false,
      message: "商城还没有可用数据源",
    },
  };
}

async function requireMallGroup(groupId) {
  const { group, selection } = await resolveMallGroup(groupId);
  if (!selection.groupId) {
    return {
      error: buildMallGroupResolutionError(selection),
    };
  }

  if (!group) {
    return {
      error: buildMallGroupResolutionError(selection),
    };
  }

  return { group, selection };
}

function normalizeMallAnalyticsTargetType(value) {
  const normalizedValue = normalizeString(value).toUpperCase();
  if (!MALL_ANALYTICS_TARGET_TYPES.has(normalizedValue)) {
    return "GROUP";
  }

  return normalizedValue;
}

function normalizeMallAnalyticsProperties(value, input = {}) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  const mallEventType = normalizeString(input.mallEventType).toUpperCase();
  const mallPage = normalizeString(input.mallPage);
  const mallSource = normalizeString(input.mallSource);
  const sourceStoreId = normalizeString(input.storeId || input.groupId);
  const sourceKeyword = normalizeString(input.keyword);

  return {
    ...source,
    mallEventType,
    mallPage: mallPage || null,
    mallSource: mallSource || null,
    sourceStoreId: sourceStoreId || null,
    sourceKeyword: sourceKeyword || null,
  };
}

function normalizeMallAnalyticsPropertiesRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function readMallAnalyticsCount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(Math.round(numericValue), 0);
}

function readMallAnalyticsMoney(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(Math.round(numericValue * 100) / 100, 0);
}

function normalizeMallCouponAnalyticsScenario(value) {
  const normalizedValue = normalizeString(value).toLowerCase();
  if (!normalizedValue) {
    return "unknown";
  }

  if (normalizedValue.includes("cart")) {
    return "cart_checkout";
  }

  if (normalizedValue.includes("buy") || normalizedValue.includes("detail")) {
    return "buy_now";
  }

  return normalizedValue;
}

function buildMallCouponAnalyticsScenarioLabel(scenario) {
  if (scenario === "cart_checkout") {
    return "购物车结算";
  }

  if (scenario === "buy_now") {
    return "立即购买";
  }

  if (scenario === "unknown") {
    return "未标记";
  }

  return scenario || "未标记";
}

function normalizeMallCouponAnalyticsSelectionMode(value) {
  const normalizedValue = normalizeString(value).toUpperCase();
  if (normalizedValue === "MANUAL" || normalizedValue === "NONE") {
    return normalizedValue;
  }

  if (normalizedValue === "AUTO") {
    return "AUTO";
  }

  return "UNKNOWN";
}

function buildMallCouponAnalyticsSelectionModeLabel(selectionMode) {
  if (selectionMode === "AUTO") {
    return "自动匹配";
  }

  if (selectionMode === "MANUAL") {
    return "手动选券";
  }

  if (selectionMode === "NONE") {
    return "明确不用券";
  }

  return "旧口径兼容/未标记";
}

function resolveMallCouponAnalyticsSelectionModeDetail(properties, mallEventType, couponApplied) {
  const rawSelectionMode = normalizeString(properties.couponSelectionMode);
  const normalizedSelectionMode = normalizeMallCouponAnalyticsSelectionMode(rawSelectionMode);
  if (normalizedSelectionMode !== "UNKNOWN") {
    return {
      couponSelectionMode: normalizedSelectionMode,
      couponSelectionModeLabel: buildMallCouponAnalyticsSelectionModeLabel(normalizedSelectionMode),
      couponSelectionModeSource: "EXPLICIT",
      couponSelectionModeExplicit: true,
      couponSelectionModeInferred: false,
      couponSelectionModeUnknown: false,
      couponSelectionModeInvalid: false,
    };
  }

  if (normalizeBoolean(properties.couponManualSelected)) {
    return {
      couponSelectionMode: "MANUAL",
      couponSelectionModeLabel: buildMallCouponAnalyticsSelectionModeLabel("MANUAL"),
      couponSelectionModeSource: "LEGACY_MANUAL_FLAG",
      couponSelectionModeExplicit: false,
      couponSelectionModeInferred: true,
      couponSelectionModeUnknown: false,
      couponSelectionModeInvalid: Boolean(rawSelectionMode),
    };
  }

  const autoApplied = normalizeBoolean(properties.couponAutoApplied);
  if (autoApplied || mallEventType === "COUPON_AUTO_APPLY") {
    return {
      couponSelectionMode: "AUTO",
      couponSelectionModeLabel: buildMallCouponAnalyticsSelectionModeLabel("AUTO"),
      couponSelectionModeSource: autoApplied ? "LEGACY_AUTO_FLAG" : "LEGACY_AUTO_EVENT",
      couponSelectionModeExplicit: false,
      couponSelectionModeInferred: true,
      couponSelectionModeUnknown: false,
      couponSelectionModeInvalid: Boolean(rawSelectionMode),
    };
  }

  if (couponApplied) {
    return {
      couponSelectionMode: "AUTO",
      couponSelectionModeLabel: buildMallCouponAnalyticsSelectionModeLabel("AUTO"),
      couponSelectionModeSource: "LEGACY_APPLIED_FALLBACK",
      couponSelectionModeExplicit: false,
      couponSelectionModeInferred: true,
      couponSelectionModeUnknown: false,
      couponSelectionModeInvalid: Boolean(rawSelectionMode),
    };
  }

  return {
    couponSelectionMode: "UNKNOWN",
    couponSelectionModeLabel: buildMallCouponAnalyticsSelectionModeLabel("UNKNOWN"),
    couponSelectionModeSource: rawSelectionMode ? "INVALID_EXPLICIT" : "UNKNOWN",
    couponSelectionModeExplicit: false,
    couponSelectionModeInferred: false,
    couponSelectionModeUnknown: true,
    couponSelectionModeInvalid: Boolean(rawSelectionMode),
  };
}

function buildMallCouponAnalyticsTrendDateKey(value) {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
}

function buildMallCouponAnalyticsTrendLabel(dateKey) {
  const normalizedDateKey = normalizeString(dateKey);
  const [yearText, monthText, dayText] = normalizedDateKey.split("-");
  const year = Number(yearText || 0);
  const month = Number(monthText || 0);
  const day = Number(dayText || 0);

  if (!year || !month || !day) {
    return normalizedDateKey || "未标记";
  }

  return `${month}/${day}`;
}

function buildMallCouponAnalyticsTrendDateKeys(days, rangeEnd) {
  const normalizedRangeEnd = rangeEnd instanceof Date ? rangeEnd : new Date();
  const anchorDate = new Date(normalizedRangeEnd.getTime());
  anchorDate.setUTCHours(0, 0, 0, 0);
  const dateKeys = [];

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const currentDate = new Date(anchorDate.getTime());
    currentDate.setUTCDate(anchorDate.getUTCDate() - dayOffset);
    dateKeys.push(currentDate.toISOString().slice(0, 10));
  }

  return dateKeys;
}

function createMallCouponAnalyticsBucket(key, label) {
  return {
    key,
    label,
    impressionCount: 0,
    availableImpressionCount: 0,
    autoApplyCount: 0,
    checkoutSubmitCount: 0,
    paymentSuccessCount: 0,
    stackedPaymentSuccessCount: 0,
    discountAmount: 0,
    memberDiscountAmount: 0,
    totalDiscountAmount: 0,
    lastEventAt: "",
    lastEventAtValue: 0,
  };
}

function updateMallCouponAnalyticsBucket(bucket, event) {
  if (!bucket || !event) {
    return;
  }

  const createdAtValue = event.createdAt ? new Date(event.createdAt).getTime() : 0;
  if (createdAtValue && createdAtValue > bucket.lastEventAtValue) {
    bucket.lastEventAtValue = createdAtValue;
    bucket.lastEventAt = new Date(createdAtValue).toISOString();
  }

  if (event.mallEventType === "COUPON_IMPRESSION") {
    bucket.impressionCount += 1;
    if (event.availableCoupon) {
      bucket.availableImpressionCount += 1;
    }
    return;
  }

  if (event.mallEventType === "COUPON_AUTO_APPLY") {
    if (event.couponApplied) {
      bucket.autoApplyCount += 1;
    }
    return;
  }

  if (event.mallEventType === "CHECKOUT_SUBMIT") {
    if (event.couponApplied) {
      bucket.checkoutSubmitCount += 1;
    }
    return;
  }

  if (event.mallEventType === "PAYMENT_SUCCESS" && event.couponApplied) {
    bucket.paymentSuccessCount += 1;
    bucket.discountAmount = readMallAnalyticsMoney(bucket.discountAmount + event.discountAmount);
    bucket.memberDiscountAmount = readMallAnalyticsMoney(bucket.memberDiscountAmount + event.memberDiscountAmount);
    bucket.totalDiscountAmount = readMallAnalyticsMoney(bucket.totalDiscountAmount + event.totalDiscountAmount);
    if (event.couponStackingApplied) {
      bucket.stackedPaymentSuccessCount += 1;
    }
  }
}

function serializeMallCouponAnalyticsBucket(bucket) {
  const autoApplyBase = bucket.availableImpressionCount > 0 ? bucket.availableImpressionCount : bucket.impressionCount;
  const autoApplyRate = autoApplyBase > 0 ? bucket.autoApplyCount / autoApplyBase : 0;
  const paymentConversionRate = bucket.checkoutSubmitCount > 0 ? bucket.paymentSuccessCount / bucket.checkoutSubmitCount : 0;
  const stackedPaymentRate = bucket.paymentSuccessCount > 0 ? bucket.stackedPaymentSuccessCount / bucket.paymentSuccessCount : 0;

  return {
    key: bucket.key,
    label: bucket.label,
    impressionCount: bucket.impressionCount,
    availableImpressionCount: bucket.availableImpressionCount,
    noCouponImpressionCount: Math.max(bucket.impressionCount - bucket.availableImpressionCount, 0),
    autoApplyCount: bucket.autoApplyCount,
    checkoutSubmitCount: bucket.checkoutSubmitCount,
    paymentSuccessCount: bucket.paymentSuccessCount,
    stackedPaymentSuccessCount: bucket.stackedPaymentSuccessCount,
    discountAmount: readMallAnalyticsMoney(bucket.discountAmount),
    discountAmountText: formatMoney(bucket.discountAmount),
    memberDiscountAmount: readMallAnalyticsMoney(bucket.memberDiscountAmount),
    memberDiscountAmountText: formatMoney(bucket.memberDiscountAmount),
    totalDiscountAmount: readMallAnalyticsMoney(bucket.totalDiscountAmount),
    totalDiscountAmountText: formatMoney(bucket.totalDiscountAmount),
    autoApplyRate,
    autoApplyRateText: formatPercent(autoApplyRate),
    paymentConversionRate,
    paymentConversionRateText: formatPercent(paymentConversionRate),
    stackedPaymentRate,
    stackedPaymentRateText: formatPercent(stackedPaymentRate),
    lastEventAt: bucket.lastEventAt,
  };
}

function createMallCouponAnalyticsCompatibilitySummary() {
  return {
    totalEventCount: 0,
    explicitSelectionModeCount: 0,
    inferredSelectionModeCount: 0,
    unknownSelectionModeCount: 0,
    invalidSelectionModeCount: 0,
    inferredManualSelectionCount: 0,
    inferredAutoSelectionCount: 0,
    inferredAppliedFallbackCount: 0,
    explicitNoneSelectionCount: 0,
  };
}

function updateMallCouponAnalyticsCompatibilitySummary(summary, event) {
  if (!summary || !event) {
    return;
  }

  summary.totalEventCount += 1;

  if (event.couponSelectionModeExplicit) {
    summary.explicitSelectionModeCount += 1;
    if (event.couponSelectionMode === "NONE") {
      summary.explicitNoneSelectionCount += 1;
    }
  }

  if (event.couponSelectionModeInferred) {
    summary.inferredSelectionModeCount += 1;
  }

  if (event.couponSelectionModeUnknown) {
    summary.unknownSelectionModeCount += 1;
  }

  if (event.couponSelectionModeInvalid) {
    summary.invalidSelectionModeCount += 1;
  }

  if (event.couponSelectionModeSource === "LEGACY_MANUAL_FLAG") {
    summary.inferredManualSelectionCount += 1;
  }

  if (
    event.couponSelectionModeSource === "LEGACY_AUTO_FLAG" ||
    event.couponSelectionModeSource === "LEGACY_AUTO_EVENT"
  ) {
    summary.inferredAutoSelectionCount += 1;
  }

  if (event.couponSelectionModeSource === "LEGACY_APPLIED_FALLBACK") {
    summary.inferredAppliedFallbackCount += 1;
  }
}

function serializeMallCouponAnalyticsCompatibilitySummary(summary) {
  const totalEventCount = readMallAnalyticsCount(summary && summary.totalEventCount);
  const explicitSelectionModeCount = readMallAnalyticsCount(summary && summary.explicitSelectionModeCount);
  const inferredSelectionModeCount = readMallAnalyticsCount(summary && summary.inferredSelectionModeCount);
  const unknownSelectionModeCount = readMallAnalyticsCount(summary && summary.unknownSelectionModeCount);
  const invalidSelectionModeCount = readMallAnalyticsCount(summary && summary.invalidSelectionModeCount);
  const inferredManualSelectionCount = readMallAnalyticsCount(summary && summary.inferredManualSelectionCount);
  const inferredAutoSelectionCount = readMallAnalyticsCount(summary && summary.inferredAutoSelectionCount);
  const inferredAppliedFallbackCount = readMallAnalyticsCount(summary && summary.inferredAppliedFallbackCount);
  const explicitNoneSelectionCount = readMallAnalyticsCount(summary && summary.explicitNoneSelectionCount);
  const legacyCompatibleEventCount = inferredSelectionModeCount + unknownSelectionModeCount;
  const explicitSelectionCoverageRate = totalEventCount > 0 ? explicitSelectionModeCount / totalEventCount : 0;
  const legacyCompatibleRate = totalEventCount > 0 ? legacyCompatibleEventCount / totalEventCount : 0;
  const unknownSelectionRate = totalEventCount > 0 ? unknownSelectionModeCount / totalEventCount : 0;

  return {
    totalEventCount,
    explicitSelectionModeCount,
    explicitSelectionCoverageRate,
    explicitSelectionCoverageRateText: formatPercent(explicitSelectionCoverageRate),
    legacyCompatibleEventCount,
    legacyCompatibleRate,
    legacyCompatibleRateText: formatPercent(legacyCompatibleRate),
    inferredSelectionModeCount,
    unknownSelectionModeCount,
    unknownSelectionRate,
    unknownSelectionRateText: formatPercent(unknownSelectionRate),
    invalidSelectionModeCount,
    inferredManualSelectionCount,
    inferredAutoSelectionCount,
    inferredAppliedFallbackCount,
    explicitNoneSelectionCount,
  };
}

function createMallCouponAnalyticsQualitySummary() {
  return {
    unknownScenarioCount: 0,
    couponAppliedWithoutCouponCodeCount: 0,
    paymentWithoutDiscountAmountCount: 0,
    stackedPaymentWithoutMemberDiscountCount: 0,
    paymentWithoutStageCount: 0,
  };
}

function updateMallCouponAnalyticsQualitySummary(summary, event) {
  if (!summary || !event) {
    return;
  }

  if (event.scenario === "unknown") {
    summary.unknownScenarioCount += 1;
  }

  if (event.couponApplied && !event.couponCode) {
    summary.couponAppliedWithoutCouponCodeCount += 1;
  }

  if (event.mallEventType !== "PAYMENT_SUCCESS" || !event.couponApplied) {
    return;
  }

  const hasDiscountAmount =
    event.discountAmount > 0 || event.memberDiscountAmount > 0 || event.totalDiscountAmount > 0;
  if (!hasDiscountAmount) {
    summary.paymentWithoutDiscountAmountCount += 1;
  }

  if (event.couponStackingApplied && event.memberDiscountAmount <= 0) {
    summary.stackedPaymentWithoutMemberDiscountCount += 1;
  }

  if (!event.couponStage) {
    summary.paymentWithoutStageCount += 1;
  }
}

function bucketHasMallCouponAnalyticsActivity(bucket) {
  if (!bucket) {
    return false;
  }

  return Boolean(
    bucket.impressionCount ||
      bucket.availableImpressionCount ||
      bucket.autoApplyCount ||
      bucket.checkoutSubmitCount ||
      bucket.paymentSuccessCount ||
      bucket.stackedPaymentSuccessCount ||
      bucket.discountAmount ||
      bucket.memberDiscountAmount ||
      bucket.totalDiscountAmount
  );
}

function buildMallCouponAnalyticsReadinessLevelLabel(readinessLevel) {
  if (readinessLevel === "READY") {
    return "可联调";
  }

  if (readinessLevel === "CHECK") {
    return "需复核";
  }

  return "高风险";
}

function serializeMallCouponAnalyticsQualitySummary(summary, trendBuckets, days, rawEventSampleSize) {
  const normalizedRawEventSampleSize = readMallAnalyticsCount(rawEventSampleSize);
  const sampleLimit = DEFAULT_MALL_COUPON_ANALYTICS_EVENT_LIMIT;
  const sampleTruncated = normalizedRawEventSampleSize >= sampleLimit;
  const activeDayCount = Array.from(trendBuckets.values()).filter(bucketHasMallCouponAnalyticsActivity).length;
  const emptyDayCount = Math.max(days - activeDayCount, 0);
  const activeDayCoverageRate = days > 0 ? activeDayCount / days : 0;
  const unknownScenarioCount = readMallAnalyticsCount(summary && summary.unknownScenarioCount);
  const couponAppliedWithoutCouponCodeCount = readMallAnalyticsCount(summary && summary.couponAppliedWithoutCouponCodeCount);
  const paymentWithoutDiscountAmountCount = readMallAnalyticsCount(summary && summary.paymentWithoutDiscountAmountCount);
  const stackedPaymentWithoutMemberDiscountCount = readMallAnalyticsCount(
    summary && summary.stackedPaymentWithoutMemberDiscountCount
  );
  const paymentWithoutStageCount = readMallAnalyticsCount(summary && summary.paymentWithoutStageCount);
  const warningCount = [
    sampleTruncated,
    unknownScenarioCount > 0,
    couponAppliedWithoutCouponCodeCount > 0,
    paymentWithoutDiscountAmountCount > 0,
    stackedPaymentWithoutMemberDiscountCount > 0,
    paymentWithoutStageCount > 0,
  ].filter(Boolean).length;
  const readinessLevel = warningCount === 0 ? "READY" : warningCount <= 2 ? "CHECK" : "RISK";

  return {
    rangeDays: days,
    rawEventSampleSize: normalizedRawEventSampleSize,
    sampleLimit,
    sampleTruncated,
    activeDayCount,
    emptyDayCount,
    activeDayCoverageRate,
    activeDayCoverageRateText: formatPercent(activeDayCoverageRate),
    unknownScenarioCount,
    couponAppliedWithoutCouponCodeCount,
    paymentWithoutDiscountAmountCount,
    stackedPaymentWithoutMemberDiscountCount,
    paymentWithoutStageCount,
    warningCount,
    readinessLevel,
    readinessLevelLabel: buildMallCouponAnalyticsReadinessLevelLabel(readinessLevel),
  };
}

function normalizeMallCouponAnalyticsEvent(event) {
  const properties = normalizeMallAnalyticsPropertiesRecord(event && event.properties);
  const mallEventType = normalizeString(properties.mallEventType).toUpperCase();
  if (!MALL_COUPON_ANALYTICS_EVENT_TYPES.has(mallEventType)) {
    return null;
  }

  const couponCode = normalizeString(properties.couponCode);
  const couponName = normalizeString(properties.couponName) || couponCode || "";
  const rawStageValue = normalizeString(properties.couponStage).toUpperCase();
  const couponStage = rawStageValue ? normalizeMallCouponStage(rawStageValue) : "";
  const couponStageLabel = normalizeString(properties.couponStageLabel) || (couponStage ? buildMallCouponStageLabel(couponStage) : "");
  const availableCount = readMallAnalyticsCount(properties.couponAvailableCount);
  const discountAmount = readMallAnalyticsMoney(properties.couponDiscountAmount);
  const couponApplied = normalizeBoolean(properties.couponApplied, Boolean(couponCode || discountAmount > 0));
  const couponVisible = normalizeBoolean(properties.couponVisible, mallEventType === "COUPON_IMPRESSION");
  const scenario = normalizeMallCouponAnalyticsScenario(properties.couponScenario || properties.mallSource);
  const memberDiscountAmount = readMallAnalyticsMoney(properties.memberDiscountAmount);
  const totalDiscountAmount = readMallAnalyticsMoney(
    properties.totalDiscountAmount || discountAmount + memberDiscountAmount
  );
  const selectionModeDetail = resolveMallCouponAnalyticsSelectionModeDetail(properties, mallEventType, couponApplied);
  const couponStackingApplied = normalizeBoolean(
    properties.couponStackingApplied,
    couponApplied && memberDiscountAmount > 0 && discountAmount > 0
  );

  return {
    mallEventType,
    couponCode,
    couponName,
    couponStage,
    couponStageLabel,
    scenario,
    scenarioLabel: buildMallCouponAnalyticsScenarioLabel(scenario),
    couponSelectionMode: selectionModeDetail.couponSelectionMode,
    couponSelectionModeLabel: selectionModeDetail.couponSelectionModeLabel,
    couponSelectionModeSource: selectionModeDetail.couponSelectionModeSource,
    couponSelectionModeExplicit: selectionModeDetail.couponSelectionModeExplicit,
    couponSelectionModeInferred: selectionModeDetail.couponSelectionModeInferred,
    couponSelectionModeUnknown: selectionModeDetail.couponSelectionModeUnknown,
    couponSelectionModeInvalid: selectionModeDetail.couponSelectionModeInvalid,
    availableCount,
    availableCoupon: couponVisible && (availableCount > 0 || Boolean(couponCode)),
    couponApplied,
    discountAmount,
    memberDiscountAmount,
    totalDiscountAmount,
    couponStackingApplied,
    createdAt: event && event.createdAt ? event.createdAt : null,
  };
}

async function trackMallAnalyticsEvent(input = {}) {
  const mallEventType = normalizeString(input.mallEventType).toUpperCase();
  if (!MALL_ANALYTICS_EVENT_TYPES.has(mallEventType)) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "不支持的商城埋点事件类型",
      },
    };
  }

  const groupResult = await requireMallGroup(input);
  if (groupResult.error) {
    return groupResult.error;
  }

  const { group } = groupResult;
  const session = await getActiveSession(input.sessionToken);
  const targetType = normalizeMallAnalyticsTargetType(input.targetType);
  const targetId = normalizeString(input.targetId);
  const eventDedupKey = normalizeString(input.eventDedupKey) || null;

  try {
    const createdEvent = await prisma.analyticsEvent.create({
      data: {
        groupId: group.id,
        userId: session ? session.userId : null,
        eventType: "PREVIEW_VIEW",
        targetType,
        targetId: targetId || null,
        eventDedupKey,
        properties: normalizeMallAnalyticsProperties(input.properties, {
          ...input,
          storeId: group.id,
        }),
      },
    });

    return {
      statusCode: 201,
      payload: {
        ok: true,
        data: {
          eventId: createdEvent.id,
          storedAsEventType: "PREVIEW_VIEW",
          mallEventType,
        },
      },
    };
  } catch (error) {
    if (error && typeof error === "object" && error.code === "P2002" && eventDedupKey) {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          data: {
            deduplicated: true,
            storedAsEventType: "PREVIEW_VIEW",
            mallEventType,
          },
        },
      };
    }

    throw error;
  }
}

async function getAdminMallCouponAnalytics(input = {}) {
  const storeId = resolveMallStoreId(input);
  const days = normalizeInteger(input.days, {
    defaultValue: DEFAULT_MALL_COUPON_ANALYTICS_DAYS,
    min: 1,
    max: MAX_MALL_COUPON_ANALYTICS_DAYS,
  });

  if (!storeId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商城数据源",
      },
    };
  }

  const rangeEnd = new Date();
  const rangeStart = new Date(rangeEnd.getTime() - days * 24 * 60 * 60 * 1000);
  const rawEvents = await prisma.analyticsEvent.findMany({
    where: {
      groupId: storeId,
      eventType: "PREVIEW_VIEW",
      createdAt: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
    select: {
      properties: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: DEFAULT_MALL_COUPON_ANALYTICS_EVENT_LIMIT,
  });

  const summaryBucket = createMallCouponAnalyticsBucket("summary", "优惠券总览");
  const scenarioBuckets = new Map();
  const stageBuckets = new Map();
  const couponBuckets = new Map();
  const selectionBuckets = new Map();
  const trendBuckets = new Map();
  const compatibilitySummary = createMallCouponAnalyticsCompatibilitySummary();
  const qualitySummary = createMallCouponAnalyticsQualitySummary();
  buildMallCouponAnalyticsTrendDateKeys(days, rangeEnd).forEach((dateKey) => {
    trendBuckets.set(dateKey, createMallCouponAnalyticsBucket(dateKey, buildMallCouponAnalyticsTrendLabel(dateKey)));
  });
  const couponEvents = rawEvents.map(normalizeMallCouponAnalyticsEvent).filter(Boolean);

  couponEvents.forEach((event) => {
    updateMallCouponAnalyticsCompatibilitySummary(compatibilitySummary, event);
    updateMallCouponAnalyticsQualitySummary(qualitySummary, event);
    updateMallCouponAnalyticsBucket(summaryBucket, event);

    if (!scenarioBuckets.has(event.scenario)) {
      scenarioBuckets.set(event.scenario, createMallCouponAnalyticsBucket(event.scenario, event.scenarioLabel));
    }
    updateMallCouponAnalyticsBucket(scenarioBuckets.get(event.scenario), event);

    if (event.couponStage) {
      if (!stageBuckets.has(event.couponStage)) {
        stageBuckets.set(
          event.couponStage,
          createMallCouponAnalyticsBucket(event.couponStage, event.couponStageLabel || buildMallCouponStageLabel(event.couponStage))
        );
      }
      updateMallCouponAnalyticsBucket(stageBuckets.get(event.couponStage), event);
    }

    if (event.couponCode) {
      if (!couponBuckets.has(event.couponCode)) {
        couponBuckets.set(
          event.couponCode,
          createMallCouponAnalyticsBucket(event.couponCode, event.couponName || event.couponCode)
        );
      }

      const couponBucket = couponBuckets.get(event.couponCode);
      couponBucket.couponCode = event.couponCode;
      couponBucket.couponName = event.couponName || event.couponCode;
      couponBucket.couponStage = event.couponStage;
      couponBucket.couponStageLabel = event.couponStageLabel || (event.couponStage ? buildMallCouponStageLabel(event.couponStage) : "");
      updateMallCouponAnalyticsBucket(couponBucket, event);
    }

    if (!selectionBuckets.has(event.couponSelectionMode)) {
      selectionBuckets.set(
        event.couponSelectionMode,
        createMallCouponAnalyticsBucket(event.couponSelectionMode, event.couponSelectionModeLabel)
      );
    }
    updateMallCouponAnalyticsBucket(selectionBuckets.get(event.couponSelectionMode), event);

    const trendDateKey = buildMallCouponAnalyticsTrendDateKey(event.createdAt);
    if (trendDateKey) {
      if (!trendBuckets.has(trendDateKey)) {
        trendBuckets.set(trendDateKey, createMallCouponAnalyticsBucket(trendDateKey, buildMallCouponAnalyticsTrendLabel(trendDateKey)));
      }
      updateMallCouponAnalyticsBucket(trendBuckets.get(trendDateKey), event);
    }
  });

  const { key: summaryKey, label: summaryLabel, ...summaryMetrics } = serializeMallCouponAnalyticsBucket(summaryBucket);
  void summaryKey;
  void summaryLabel;

  const scenarioOrder = {
    cart_checkout: 0,
    buy_now: 1,
    unknown: 99,
  };
  const stageOrder = {
    [MALL_COUPON_STAGE_NEWCOMER]: 0,
    [MALL_COUPON_STAGE_FIRST_ORDER]: 1,
    [MALL_COUPON_STAGE_REPURCHASE]: 2,
    [MALL_COUPON_STAGE_GENERAL]: 3,
  };
  const selectionOrder = {
    AUTO: 0,
    MANUAL: 1,
    NONE: 2,
    UNKNOWN: 99,
  };

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        summary: {
          rangeDays: days,
          startAt: rangeStart.toISOString(),
          endAt: rangeEnd.toISOString(),
          eventSampleSize: couponEvents.length,
          activeCouponCount: couponBuckets.size,
          ...summaryMetrics,
        },
        scenarioBreakdown: Array.from(scenarioBuckets.values())
          .map((item) => serializeMallCouponAnalyticsBucket(item))
          .sort((left, right) => {
            const leftOrder = Object.prototype.hasOwnProperty.call(scenarioOrder, left.key) ? scenarioOrder[left.key] : 50;
            const rightOrder = Object.prototype.hasOwnProperty.call(scenarioOrder, right.key) ? scenarioOrder[right.key] : 50;
            if (leftOrder !== rightOrder) {
              return leftOrder - rightOrder;
            }

            return right.paymentSuccessCount - left.paymentSuccessCount || right.impressionCount - left.impressionCount;
          }),
        stageBreakdown: Array.from(stageBuckets.values())
          .map((item) => serializeMallCouponAnalyticsBucket(item))
          .sort((left, right) => {
            const leftOrder = Object.prototype.hasOwnProperty.call(stageOrder, left.key) ? stageOrder[left.key] : 50;
            const rightOrder = Object.prototype.hasOwnProperty.call(stageOrder, right.key) ? stageOrder[right.key] : 50;
            if (leftOrder !== rightOrder) {
              return leftOrder - rightOrder;
            }

            return right.paymentSuccessCount - left.paymentSuccessCount || right.impressionCount - left.impressionCount;
          }),
        selectionBreakdown: Array.from(selectionBuckets.values())
          .map((item) => serializeMallCouponAnalyticsBucket(item))
          .sort((left, right) => {
            const leftOrder = Object.prototype.hasOwnProperty.call(selectionOrder, left.key) ? selectionOrder[left.key] : 50;
            const rightOrder = Object.prototype.hasOwnProperty.call(selectionOrder, right.key) ? selectionOrder[right.key] : 50;
            if (leftOrder !== rightOrder) {
              return leftOrder - rightOrder;
            }

            return right.paymentSuccessCount - left.paymentSuccessCount || right.impressionCount - left.impressionCount;
          }),
        compatibilitySummary: serializeMallCouponAnalyticsCompatibilitySummary(compatibilitySummary),
        qualitySummary: serializeMallCouponAnalyticsQualitySummary(qualitySummary, trendBuckets, days, rawEvents.length),
        dailyTrend: Array.from(trendBuckets.entries())
          .sort((left, right) => left[0].localeCompare(right[0]))
          .map(([, item]) => {
            const serializedBucket = serializeMallCouponAnalyticsBucket(item);
            return {
              date: item.key,
              label: item.label,
              ...serializedBucket,
            };
          }),
        couponRows: Array.from(couponBuckets.values())
          .map((item) => {
            const serializedBucket = serializeMallCouponAnalyticsBucket(item);
            return {
              ...serializedBucket,
              couponCode: item.couponCode || serializedBucket.key,
              couponName: item.couponName || serializedBucket.label,
              couponStage: item.couponStage || "",
              couponStageLabel: item.couponStageLabel || "",
            };
          })
          .sort((left, right) => {
            return (
              right.paymentSuccessCount - left.paymentSuccessCount ||
              right.totalDiscountAmount - left.totalDiscountAmount ||
              right.memberDiscountAmount - left.memberDiscountAmount ||
              right.discountAmount - left.discountAmount ||
              right.checkoutSubmitCount - left.checkoutSubmitCount ||
              right.autoApplyCount - left.autoApplyCount ||
              right.impressionCount - left.impressionCount
            );
          }),
      },
    },
  };
}

function normalizeMallMetadataRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...value };
}

function normalizeMallConfigText(value, defaultValue, maxLength = 120) {
  const normalizedValue = normalizeString(value).slice(0, maxLength);
  return normalizedValue || defaultValue;
}

function buildDefaultMallMemberZoneConfig(storeName = "商城") {
  return {
    title: `${storeName}会员商品专区`,
    subtitle: "集中展示会员价、会员专享与适合开通后立即购买的权益商品。",
    badgeText: "会员权益商品",
    highlightText: "默认优先展示会员专享商品，再展示会员价商品；如需指定商品集合，可在此配置 productIds。",
    emptyTitle: "会员商品专区暂未上架",
    emptySubtitle: "请先给商品配置会员价或会员专享权益，专区会自动承接这些商品。",
    productIds: [],
    sortMode: MALL_MEMBER_ZONE_SORT_MODE_MEMBER_EXCLUSIVE_FIRST,
  };
}

function normalizeMallMemberZoneSortMode(value) {
  const normalizedValue = normalizeString(value).toUpperCase();
  if (MALL_MEMBER_ZONE_SORT_MODES.has(normalizedValue)) {
    return normalizedValue;
  }

  return MALL_MEMBER_ZONE_SORT_MODE_MEMBER_EXCLUSIVE_FIRST;
}

function normalizeMallMemberZoneProductIds(value) {
  const sourceItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,，]/)
      : [];
  const seenProductIds = new Set();
  const productIds = [];

  sourceItems.forEach((item) => {
    const productId = normalizeString(item);
    if (!productId || seenProductIds.has(productId)) {
      return;
    }

    seenProductIds.add(productId);
    productIds.push(productId);
  });

  return productIds.slice(0, DEFAULT_MALL_MEMBER_ZONE_PRODUCT_LIMIT);
}

function normalizeMallMemberZoneConfig(value, storeName = "商城") {
  const defaultConfig = buildDefaultMallMemberZoneConfig(storeName);
  const config = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return {
    title: normalizeMallConfigText(config.title, defaultConfig.title, 40),
    subtitle: normalizeMallConfigText(config.subtitle, defaultConfig.subtitle, 120),
    badgeText: normalizeMallConfigText(config.badgeText, defaultConfig.badgeText, 20),
    highlightText: normalizeMallConfigText(config.highlightText, defaultConfig.highlightText, 160),
    emptyTitle: normalizeMallConfigText(config.emptyTitle, defaultConfig.emptyTitle, 40),
    emptySubtitle: normalizeMallConfigText(config.emptySubtitle, defaultConfig.emptySubtitle, 120),
    productIds: normalizeMallMemberZoneProductIds(config.productIds),
    sortMode: normalizeMallMemberZoneSortMode(config.sortMode),
  };
}

function readMallMemberZoneConfigFromMetadata(metadata, storeName = "商城") {
  const groupMetadata = normalizeMallMetadataRecord(metadata);
  const mallConfig = normalizeMallMetadataRecord(groupMetadata.mallConfig);
  return normalizeMallMemberZoneConfig(mallConfig.memberZoneConfig, storeName);
}

function writeMallMemberZoneConfigToMetadata(metadata, memberZoneConfig, storeName = "商城") {
  const groupMetadata = normalizeMallMetadataRecord(metadata);
  const mallConfig = normalizeMallMetadataRecord(groupMetadata.mallConfig);

  return {
    ...groupMetadata,
    mallConfig: {
      ...mallConfig,
      memberZoneConfig: normalizeMallMemberZoneConfig(memberZoneConfig, storeName),
    },
  };
}

async function getMallConfig(input = {}) {
  const groupResult = await requireMallGroup(input);
  if (groupResult.error) {
    return groupResult.error;
  }

  const { group, selection } = groupResult;
  const storeName = normalizeString(group.name) || "商城";
  const searchHotKeywords = ["入门", "热卖", "套装", "分享"];
  const memberZoneConfig = readMallMemberZoneConfigFromMetadata(group.metadata, storeName);
  const quickEntryItems = [
    {
      id: "starter",
      title: "新手入门",
      subtitle: "先看低门槛商品",
      action: "search",
      keyword: "入门",
    },
    {
      id: "hot",
      title: "热门方案",
      subtitle: "看看主推热卖",
      action: "search",
      keyword: "热卖",
    },
    {
      id: "member",
      title: "会员专享",
      subtitle: "优先找会员权益商品",
      action: "search",
      keyword: "会员",
    },
    {
      id: "share",
      title: "分享可赚",
      subtitle: "查看带佣商品",
      action: "commission",
      keyword: "分享",
    },
  ];
  const serviceFaqItems = [
    {
      id: "shipping",
      title: "多久发货",
      content: `${storeName}订单支付成功后，商家会尽快处理并同步发货进度。`,
    },
    {
      id: "refund",
      title: "如何申请售后",
      content: "未发货订单可直接在订单详情申请退款，已发货退货退款后续会继续补强。",
    },
    {
      id: "address",
      title: "地址怎么修改",
      content: "下单前请在商城地址页维护收货地址，下单层只负责选择已有地址。",
    },
  ];

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        storeId: group.id,
        storeName,
        source: selection.source,
        searchHotKeywords,
        quickEntryItems,
        memberZoneConfig,
        serviceTitle: `${storeName}客服`,
        serviceHours: "建议工作日 09:00 - 18:00 优先处理",
        serviceContactHint: "如果发货、退款或商品信息有疑问，请先查看下方常见问题，再联系商家人工处理。",
        serviceFaqItems,
      },
    },
  };
}

async function getAdminMallMemberZoneConfig(input = {}) {
  const groupResult = await requireMallGroup(input.storeId || input.groupId || input);
  if (groupResult.error) {
    return groupResult.error;
  }

  const { group } = groupResult;
  const storeName = normalizeString(group.name) || "商城";

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        storeId: group.id,
        storeName,
        config: readMallMemberZoneConfigFromMetadata(group.metadata, storeName),
        ignoredProductIds: [],
      },
    },
  };
}

async function updateAdminMallMemberZoneConfig(input = {}) {
  const groupResult = await requireMallGroup(input.storeId || input.groupId || input);
  if (groupResult.error) {
    return groupResult.error;
  }

  const { group } = groupResult;
  const storeName = normalizeString(group.name) || "商城";
  const requestedConfig = normalizeMallMemberZoneConfig(input.config || input, storeName);
  let ignoredProductIds = [];
  let productIds = requestedConfig.productIds;

  if (productIds.length) {
    const productRows = await prisma.mallProduct.findMany({
      where: {
        groupId: group.id,
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
      },
    });
    const availableProductIdSet = new Set(productRows.map((item) => normalizeString(item.id)).filter(Boolean));
    ignoredProductIds = productIds.filter((productId) => !availableProductIdSet.has(productId));
    productIds = productIds.filter((productId) => availableProductIdSet.has(productId));
  }

  const nextConfig = {
    ...requestedConfig,
    productIds,
  };
  const updatedGroup = await prisma.group.update({
    where: {
      id: group.id,
    },
    data: {
      metadata: writeMallMemberZoneConfigToMetadata(group.metadata, nextConfig, storeName),
    },
    select: {
      id: true,
      name: true,
      metadata: true,
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      message: "会员专区配置已更新",
      data: {
        storeId: updatedGroup.id,
        storeName: normalizeString(updatedGroup.name) || storeName,
        config: readMallMemberZoneConfigFromMetadata(updatedGroup.metadata, storeName),
        ignoredProductIds,
      },
    },
  };
}

async function listMallCoupons(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const groupResult = await requireMallGroup(input.storeId || input.groupId || input);
  if (groupResult.error) {
    return groupResult.error;
  }

  const { group } = groupResult;
  const couponResult = await listEligibleMallCouponsByClient(prisma, group.id, sessionResult.session.userId);
  const items = couponResult.items.map((coupon, index) => ({
    ...serializeMallCoupon(coupon),
    isRecommended: index === 0,
  }));

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        storeId: group.id,
        mallPaidOrderCount: couponResult.mallPaidOrderCount,
        items,
      },
    },
  };
}

function buildCategoryPayload(category, productCountMap) {
  return {
    id: category.id,
    storeId: category.groupId,
    name: category.name,
    slug: category.slug || "",
    sortOrder: category.sortOrder,
    isEnabled: Boolean(category.isEnabled),
    productCount: productCountMap.get(category.id) || 0,
    createdAt: toIso(category.createdAt),
    updatedAt: toIso(category.updatedAt),
  };
}

function buildProductPayload(product, options = {}) {
  const cartQuantityMap = options.cartQuantityMap || new Map();
  const quantity = cartQuantityMap.get(product.id) || 0;
  const membershipSummary =
    options.membershipSummary || getMallMembershipSummaryByGroupId(options.membershipSummaryMap, product.groupId);
  const benefitState = resolveMallProductBenefitState(product, {
    resolveMembership: options.resolveMembership === true,
    membershipSummary,
  });
  const detailImages = Array.isArray(product.detailImages)
    ? product.detailImages.map(buildProductDetailImagePayload)
    : [];

  return {
    id: product.id,
    storeId: product.groupId,
    categoryId: product.categoryId,
    categoryName: product.category ? product.category.name : "",
    title: product.title,
    subtitle: product.subtitle || "",
    coverImageUrl: product.coverImageUrl || "",
    coverFallbackText: buildFallbackCoverText(product.title),
    price: benefitState.effectivePrice,
    priceText: benefitState.effectivePriceText,
    originalPrice: benefitState.effectiveOriginalPrice,
    originalPriceText: benefitState.effectiveOriginalPriceText,
    publicPrice: benefitState.publicPrice,
    publicPriceText: benefitState.publicPriceText,
    memberPrice: benefitState.memberPrice,
    memberPriceText: benefitState.memberPriceText,
    memberBenefitType: benefitState.memberBenefitType,
    memberBenefitLabel: benefitState.memberBenefitLabel,
    membershipActive: benefitState.membershipActive,
    canPurchase: benefitState.canPurchase,
    memberPromptText: benefitState.memberPromptText,
    stock: product.stock,
    isOnSale: Boolean(product.isOnSale),
    sortOrder: product.sortOrder,
    cartQuantity: quantity,
    detailImages,
    createdAt: toIso(product.createdAt),
    updatedAt: toIso(product.updatedAt),
  };
}

function buildProductDetailImagePayload(detailImage) {
  return {
    id: detailImage.id,
    storeId: detailImage.groupId,
    productId: detailImage.productId,
    mediaType: normalizeMallProductDetailImageMediaType(detailImage.mediaType),
    imageUrl: detailImage.imageUrl || "",
    title: detailImage.title || "",
    description: detailImage.description || "",
    sortOrder: detailImage.sortOrder,
    isEnabled: Boolean(detailImage.isEnabled),
    createdAt: toIso(detailImage.createdAt),
    updatedAt: toIso(detailImage.updatedAt),
  };
}

function buildCartPayload(cartItems, options = {}) {
  const items = cartItems.map((cartItem) => {
    const product = cartItem.product;
    const membershipSummary = getMallMembershipSummaryByGroupId(options.membershipSummaryMap, product.groupId);
    const benefitState = resolveMallProductBenefitState(product, {
      resolveMembership: true,
      membershipSummary,
    });
    const totalAmount = benefitState.effectivePrice * cartItem.quantity;

    return {
      id: cartItem.id,
      productId: product.id,
      storeId: product.groupId,
      categoryId: product.categoryId,
      categoryName: product.category ? product.category.name : "",
      title: product.title,
      subtitle: product.subtitle || "",
      coverImageUrl: product.coverImageUrl || "",
      coverFallbackText: buildFallbackCoverText(product.title),
      price: benefitState.effectivePrice,
      priceText: benefitState.effectivePriceText,
      originalPrice: benefitState.effectiveOriginalPrice,
      originalPriceText: benefitState.effectiveOriginalPriceText,
      publicPrice: benefitState.publicPrice,
      publicPriceText: benefitState.publicPriceText,
      memberPrice: benefitState.memberPrice,
      memberPriceText: benefitState.memberPriceText,
      memberBenefitType: benefitState.memberBenefitType,
      memberBenefitLabel: benefitState.memberBenefitLabel,
      membershipActive: benefitState.membershipActive,
      canPurchase: benefitState.canPurchase,
      memberPromptText: benefitState.memberPromptText,
      quantity: cartItem.quantity,
      stock: product.stock,
      isOnSale: Boolean(product.isOnSale),
      totalAmount,
      totalAmountText: totalAmount.toFixed(2),
      createdAt: toIso(cartItem.createdAt),
      updatedAt: toIso(cartItem.updatedAt),
    };
  });

  const cartCount = items.reduce((total, item) => total + item.quantity, 0);
  const totalAmount = items.reduce((total, item) => total + item.totalAmount, 0);

  return {
    cartCount,
    totalAmount,
    totalAmountText: totalAmount.toFixed(2),
    items,
  };
}

function buildMallOrderItemPayload(orderItem) {
  return {
    id: orderItem.id,
    productId: orderItem.productId || "",
    title: orderItem.productTitle,
    subtitle: orderItem.productSubtitle || "",
    coverImageUrl: orderItem.coverImageUrl || "",
    coverFallbackText: buildFallbackCoverText(orderItem.productTitle),
    unitPrice: toMoneyNumber(orderItem.unitPrice),
    unitPriceText: formatMoney(orderItem.unitPrice),
    quantity: orderItem.quantity,
    totalAmount: toMoneyNumber(orderItem.totalAmount),
    totalAmountText: formatMoney(orderItem.totalAmount),
    createdAt: toIso(orderItem.createdAt),
  };
}

function buildMallUserSummary(user, fallbackUserId = "") {
  const normalizedUserId = normalizeString(user && user.id ? user.id : fallbackUserId);
  const nickname =
    user && user.profile && user.profile.nickname
      ? user.profile.nickname
      : normalizedUserId
        ? `用户${String(normalizedUserId).slice(-4)}`
        : "匿名用户";

  return {
    id: normalizedUserId,
    nickname,
    mobile: user && user.mobile ? user.mobile : "",
  };
}

async function buildMallShareUserSummaryMap(orders = []) {
  const shareUserIds = Array.from(
    new Set(
      (Array.isArray(orders) ? orders : [])
        .map((order) => normalizeString(order && order.shareSharerUserId))
        .filter(Boolean),
    ),
  );

  if (!shareUserIds.length) {
    return {};
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: shareUserIds,
      },
    },
    include: {
      profile: true,
    },
  });

  return users.reduce((result, user) => {
    result[user.id] = buildMallUserSummary(user, user.id);
    return result;
  }, {});
}

function buildMallOrderPayload(order, options = {}) {
  const includeUser = options.includeUser === true;
  const shareUserMap = options.shareUserMap || {};
  const remarkSummary = parseMallOrderStoredRemark(order && order.remark);
  const couponMeta = remarkSummary.couponMeta;
  const pricingMeta = remarkSummary.pricingMeta;
  const shareCommissionStatus = normalizeString(order.shareCommissionStatus).toUpperCase() || "NONE";
  const shareSharerUserId = normalizeString(order.shareSharerUserId);
  const shareProductId = normalizeString(order.shareProductId);
  const shareCommissionRate = toMoneyNumber(order.shareCommissionRate);
  const shareCommissionBaseAmount = toMoneyNumber(order.shareCommissionBaseAmount);
  const shareCommissionAmount = toMoneyNumber(order.shareCommissionAmount);
  const payableAmount = toMoneyNumber(order.payableAmount);
  const couponDiscountAmount = couponMeta
    ? normalizeMoneyNumber(couponMeta.discountAmount, { defaultValue: 0, min: 0 })
    : normalizeMoneyNumber(toMoneyNumber(order.totalAmount) - payableAmount, { defaultValue: 0, min: 0 });
  const publicAmount = pricingMeta
    ? normalizeMoneyNumber(pricingMeta.publicAmount, { defaultValue: toMoneyNumber(order.totalAmount), min: 0 })
    : toMoneyNumber(order.totalAmount);
  const memberDiscountAmount = pricingMeta
    ? normalizeMoneyNumber(pricingMeta.memberDiscountAmount, { defaultValue: 0, min: 0 })
    : 0;
  const totalDiscountAmount = pricingMeta
    ? normalizeMoneyNumber(pricingMeta.totalDiscountAmount, { defaultValue: memberDiscountAmount + couponDiscountAmount, min: 0 })
    : normalizeMoneyNumber(memberDiscountAmount + couponDiscountAmount, { defaultValue: couponDiscountAmount, min: 0 });
  const couponStackingApplied = pricingMeta
    ? Boolean(pricingMeta.couponStackingApplied)
    : memberDiscountAmount > 0 && couponDiscountAmount > 0;
  const couponStackingRule = pricingMeta ? normalizeString(pricingMeta.couponStackingRule) : "";
  const couponStackingRuleText = pricingMeta
    ? normalizeString(pricingMeta.couponStackingRuleText)
    : buildMallCouponStackingRuleText(memberDiscountAmount);
  const pricingInspection = buildMallOrderPricingInspection(order, {
    couponMeta,
    pricingMeta,
    orderAmount: toMoneyNumber(order.totalAmount),
    payableAmount,
    couponDiscountAmount,
    memberDiscountAmount,
    totalDiscountAmount,
  });
  const shippingStatus = normalizeMallShippingStatus(order.shippingStatus);
  const refundStatus = normalizeMallRefundStatus(order.refundStatus);
  const refundAmount = toMoneyNumber(order.refundAmount || order.payableAmount);
  const sharedOrderItem = shareProductId ? order.items.find((item) => item.productId === shareProductId) : null;
  const paymentStatus = buildMallPaymentStatus(order);
  const canPay = paymentStatus === "UNPAID" && Math.round(payableAmount * 100) > 0;
  const canRequestRefund = canMallOrderRequestRefund(order);
  const canConfirmReceipt = canMallOrderConfirmReceipt(order);
  const shareApplied = Boolean(shareSharerUserId && shareProductId && shareCommissionAmount > 0);
  const shareSharer = shareSharerUserId
    ? shareUserMap[shareSharerUserId] || buildMallUserSummary(null, shareSharerUserId)
    : undefined;

  return {
    id: order.id,
    storeId: order.groupId,
    userId: order.userId,
    orderNo: order.orderNo,
    status: order.status,
    statusLabel: buildMallOrderStatusLabel(order.status),
    publicAmount,
    publicAmountText: formatMoney(publicAmount),
    totalAmount: toMoneyNumber(order.totalAmount),
    totalAmountText: formatMoney(order.totalAmount),
    memberDiscountAmount,
    memberDiscountAmountText: formatMoney(memberDiscountAmount),
    discountAmount: couponDiscountAmount,
    discountAmountText: formatMoney(couponDiscountAmount),
    couponDiscountAmount,
    couponDiscountAmountText: formatMoney(couponDiscountAmount),
    totalDiscountAmount,
    totalDiscountAmountText: formatMoney(totalDiscountAmount),
    payableAmount,
    payableAmountText: formatMoney(order.payableAmount),
    pricingInspection,
    couponStackingApplied,
    couponStackingRule,
    couponStackingRuleText,
    paymentStatus,
    paymentStatusLabel: buildMallPaymentStatusLabel(paymentStatus),
    paymentRequired: canPay,
    canPay,
    canRequestRefund,
    canConfirmReceipt,
    remark: remarkSummary.buyerRemark,
    coupon: couponMeta
      ? {
          code: normalizeString(couponMeta.code),
          name: normalizeString(couponMeta.name),
          stage: normalizeMallCouponStage(couponMeta.stage),
          stageLabel: normalizeString(couponMeta.stageLabel) || buildMallCouponStageLabel(couponMeta.stage),
        }
      : undefined,
    memberPriceItemCount: pricingMeta ? normalizeInteger(pricingMeta.memberPriceItemCount, { defaultValue: 0, min: 0 }) : 0,
    memberExclusiveItemCount: pricingMeta
      ? normalizeInteger(pricingMeta.memberExclusiveItemCount, { defaultValue: 0, min: 0 })
      : 0,
    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
    createdAt: toIso(order.createdAt),
    updatedAt: toIso(order.updatedAt),
    shareApplied,
    shareSharerUserId,
    shareSharer,
    shareCommissionRecipient: shareSharer,
    shareProductId,
    shareProductTitle: sharedOrderItem ? sharedOrderItem.productTitle : "",
    shareCommissionRate,
    shareCommissionRateText: formatPercent(shareCommissionRate),
    shareCommissionBaseAmount,
    shareCommissionBaseAmountText: formatMoney(order.shareCommissionBaseAmount),
    shareCommissionAmount,
    shareCommissionAmountText: formatMoney(order.shareCommissionAmount),
    shareCommissionStatus,
    shareCommissionStatusLabel: buildMallCommissionStatusLabel(shareCommissionStatus),
    shareCommissionSettledAt: toIso(order.shareCommissionSettledAt),
    shippingStatus,
    shippingStatusLabel: buildMallShippingStatusLabel(order),
    shippingCompany: normalizeString(order.shippingCompany),
    shippingTrackingNo: normalizeString(order.shippingTrackingNo),
    shippingRemark: normalizeString(order.shippingRemark),
    shippedAt: toIso(order.shippedAt),
    refundStatus,
    refundStatusLabel: buildMallRefundStatusLabel(refundStatus),
    refundReason: normalizeString(order.refundReason),
    refundReviewRemark: normalizeString(order.refundReviewRemark),
    refundRequestedAt: toIso(order.refundRequestedAt),
    refundReviewedAt: toIso(order.refundReviewedAt),
    refundReviewerUserId: normalizeString(order.refundReviewerUserId),
    refundAmount,
    refundAmountText: formatMoney(order.refundAmount || order.payableAmount),
    refundOutRefundNo: normalizeString(order.refundOutRefundNo),
    refundWechatRefundId: normalizeString(order.refundWechatRefundId),
    refundWechatStatus: normalizeString(order.refundWechatStatus),
    refundUserReceivedAccount: normalizeString(order.refundUserReceivedAccount),
    refundedAt: toIso(order.refundedAt),
    shippingAddress: {
      recipientName: order.shippingRecipientName || "",
      phone: order.shippingRecipientPhone || "",
      province: order.shippingProvince || "",
      city: order.shippingCity || "",
      district: order.shippingDistrict || "",
      detailAddress: order.shippingDetailAddress || "",
      fullAddress: buildMallShippingAddressFullAddress({
        province: order.shippingProvince,
        city: order.shippingCity,
        district: order.shippingDistrict,
        detailAddress: order.shippingDetailAddress,
      }),
    },
    items: order.items.map(buildMallOrderItemPayload),
    user: includeUser ? buildMallUserSummary(order.user, order.userId) : undefined,
  };
}

function buildMallCommissionOrderPayload(order) {
  const shareCommissionStatus = normalizeString(order.shareCommissionStatus).toUpperCase() || "NONE";
  const shareProductId = normalizeString(order.shareProductId);
  const shareCommissionRate = toMoneyNumber(order.shareCommissionRate);
  const shareCommissionBaseAmount = toMoneyNumber(order.shareCommissionBaseAmount);
  const shareCommissionAmount = toMoneyNumber(order.shareCommissionAmount);
  const shippingStatus = normalizeMallShippingStatus(order.shippingStatus);
  const refundStatus = normalizeMallRefundStatus(order.refundStatus);
  const sharedOrderItem = shareProductId ? order.items.find((item) => item.productId === shareProductId) : null;
  const displayItems = (sharedOrderItem ? [sharedOrderItem] : order.items.slice(0, 1)).map((item) => ({
    id: item.id,
    productId: item.productId || "",
    title: item.productTitle,
    coverImageUrl: item.coverImageUrl || "",
    coverFallbackText: buildFallbackCoverText(item.productTitle),
  }));

  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    statusLabel: buildMallOrderStatusLabel(order.status),
    shippingStatus,
    shippingStatusLabel: buildMallShippingStatusLabel(order),
    refundStatus,
    refundStatusLabel: buildMallRefundStatusLabel(refundStatus),
    shareProductId,
    shareProductTitle: sharedOrderItem ? sharedOrderItem.productTitle : "",
    shareCommissionRate,
    shareCommissionRateText: formatPercent(shareCommissionRate),
    shareCommissionBaseAmount,
    shareCommissionBaseAmountText: formatMoney(order.shareCommissionBaseAmount),
    shareCommissionAmount,
    shareCommissionAmountText: formatMoney(order.shareCommissionAmount),
    shareCommissionStatus,
    shareCommissionStatusLabel: buildMallCommissionStatusLabel(shareCommissionStatus),
    shareCommissionSettledAt: toIso(order.shareCommissionSettledAt),
    createdAt: toIso(order.createdAt),
    updatedAt: toIso(order.updatedAt),
    items: displayItems,
  };
}

function buildMallPaymentPayload(order, options = {}) {
  const paymentStatus = buildMallPaymentStatus(order);
  const required =
    typeof options.required === "boolean"
      ? options.required
      : paymentStatus === "UNPAID" && Math.round(toMoneyNumber(order && order.payableAmount) * 100) > 0;

  return {
    channel: "WECHAT",
    status: paymentStatus,
    required,
    request: options.request || null,
    errorMessage: normalizeString(options.errorMessage),
  };
}

async function findMallOrderByOrderNo(orderNo, options = {}) {
  const normalizedOrderNo = normalizeString(orderNo);
  if (!normalizedOrderNo) {
    return null;
  }

  const include = {
    items: true,
  };

  if (options.includeUser) {
    include.user = {
      include: {
        profile: true,
      },
    };
  }

  return prisma.mallOrder.findUnique({
    where: {
      orderNo: normalizedOrderNo,
    },
    include,
  });
}

async function createMallWechatPaymentRequest(input = {}) {
  const order = input.order || null;
  const user = input.user || null;

  if (!order || !order.orderNo) {
    throw new Error("缺少商城订单信息，无法发起支付");
  }

  if (!user) {
    throw new Error("缺少支付用户信息，无法发起支付");
  }

  const group =
    input.group ||
    (await prisma.group.findUnique({
      where: {
        id: order.groupId,
      },
      select: {
        id: true,
        name: true,
      },
    }));

  const payment = await createJsapiPayment({
    order: {
      orderNo: order.orderNo,
      amount: toMoneyNumber(order.payableAmount),
      type: "MALL",
    },
    user,
    group,
    description: `商城-${group && group.name ? group.name : "血饮商城"}`,
  });

  return {
    prepayId: payment.prepayId,
    request: payment.request,
  };
}

async function applyMallOrderPaymentSuccess(input = {}) {
  const orderNo = normalizeString(input.orderNo);
  const transactionNo = normalizeString(input.transactionNo);
  const success = input.success !== false;

  if (!orderNo) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商城订单号",
      },
    };
  }

  const order = await findMallOrderByOrderNo(orderNo);
  if (!order) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "商城订单不存在",
      },
    };
  }

  if (order.status === "PAID") {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          order: buildMallOrderPayload(order),
          transactionNo,
          idempotent: true,
        },
      },
    };
  }

  if (order.status === "CLOSED") {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: "订单已关闭，不能重复支付",
      },
    };
  }

  if (!success) {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          order: buildMallOrderPayload(order),
          transactionNo,
          idempotent: false,
        },
      },
    };
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const paidOrder = await tx.mallOrder.update({
      where: {
        id: order.id,
      },
      data: {
        status: "PAID",
        ...buildMallShareCommissionUpdate(order, "PAID"),
      },
      include: {
        items: true,
      },
    });

    await consumeMallOrderCouponUsage(tx, paidOrder);
    return paidOrder;
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        order: buildMallOrderPayload(updatedOrder),
        transactionNo,
        idempotent: false,
      },
    },
  };
}

async function trySyncMallWechatPaymentStatus(order) {
  if (!order || order.status !== "PENDING" || !order.orderNo) {
    return false;
  }

  try {
    const queriedOrder = await queryJsapiPaymentOrderByOutTradeNo(order.orderNo);
    const expectedAmount = Math.round(toMoneyNumber(order.payableAmount) * 100);

    if (queriedOrder.tradeState !== "SUCCESS" || !queriedOrder.transactionNo) {
      return false;
    }

    if (Number.isFinite(queriedOrder.amountTotal) && queriedOrder.amountTotal !== expectedAmount) {
      return false;
    }

    const paymentResult = await applyMallOrderPaymentSuccess({
      orderNo: order.orderNo,
      transactionNo: queriedOrder.transactionNo,
      success: true,
    });

    return paymentResult.statusCode === 200 && paymentResult.payload && paymentResult.payload.ok;
  } catch (error) {
    return false;
  }
}

async function closeExpiredMallOrderById(orderId, options = {}) {
  const normalizedOrderId = normalizeString(orderId);
  const now = options.now || Date.now();
  let order = options.order || null;

  if (!normalizedOrderId) {
    return {
      closed: false,
      paid: false,
      order: null,
    };
  }

  if (!order) {
    order = await prisma.mallOrder.findUnique({
      where: {
        id: normalizedOrderId,
      },
      include: {
        items: true,
      },
    });
  }

  if (!order || !isMallOrderExpired(order, now)) {
    return {
      closed: false,
      paid: false,
      order,
    };
  }

  if (await trySyncMallWechatPaymentStatus(order)) {
    const syncedOrder = await prisma.mallOrder.findUnique({
      where: {
        id: normalizedOrderId,
      },
      include: {
        items: true,
      },
    });

    return {
      closed: false,
      paid: Boolean(syncedOrder && syncedOrder.status === "PAID"),
      order: syncedOrder,
    };
  }

  const closedOrder = await prisma.$transaction(async (tx) => {
    const existingOrder = await tx.mallOrder.findUnique({
      where: {
        id: normalizedOrderId,
      },
      include: {
        items: true,
      },
    });

    if (!existingOrder || !isMallOrderExpired(existingOrder, now)) {
      return null;
    }

    const updateResult = await tx.mallOrder.updateMany({
      where: {
        id: existingOrder.id,
        status: "PENDING",
      },
      data: {
        status: "CLOSED",
        ...buildMallShareCommissionUpdate(existingOrder, "CLOSED"),
      },
    });

    if (updateResult.count !== 1) {
      return null;
    }

    for (const item of existingOrder.items) {
      if (!item.productId) {
        continue;
      }

      await tx.mallProduct.updateMany({
        where: {
          id: item.productId,
        },
        data: {
          stock: {
            increment: item.quantity,
          },
        },
      });
    }

    return tx.mallOrder.findUnique({
      where: {
        id: existingOrder.id,
      },
      include: {
        items: true,
      },
    });
  });

  return {
    closed: Boolean(closedOrder),
    paid: false,
    order: closedOrder || order,
  };
}

async function settleExpiredMallOrders(input = {}) {
  const where = {
    status: "PENDING",
    createdAt: {
      lte: getMallOrderExpireBefore(input.now || Date.now()),
    },
  };
  const orderId = normalizeString(input.orderId);
  const userId = normalizeString(input.userId);
  const groupId = resolveMallStoreId(input);
  const limit = normalizeInteger(input.limit, { defaultValue: 20, min: 1, max: 200 });

  if (orderId) {
    where.id = orderId;
  }

  if (userId) {
    where.userId = userId;
  }

  if (groupId) {
    where.groupId = groupId;
  }

  const expiredOrders = await prisma.mallOrder.findMany({
    where,
    include: {
      items: true,
    },
    orderBy: [{ createdAt: "asc" }],
    take: limit,
  });

  let closedCount = 0;
  let paidCount = 0;

  for (const order of expiredOrders) {
    const result = await closeExpiredMallOrderById(order.id, {
      order,
      now: input.now,
    });

    if (result.closed) {
      closedCount += 1;
    } else if (result.paid) {
      paidCount += 1;
    }
  }

  return {
    closedCount,
    paidCount,
  };
}

function startMallOrderAutoCloseScheduler() {
  if (mallOrderAutoCloseTimer) {
    return;
  }

  const intervalMs = resolveMallOrderAutoCloseIntervalMs();
  const runSweep = () =>
    settleExpiredMallOrders({
      limit: 50,
    })
      .then((result) => {
        if (result.closedCount || result.paidCount) {
          console.log(
            `[mall-order] auto-close settled closed=${result.closedCount} paid=${result.paidCount} window=${resolveMallOrderAutoCloseMinutes()}m`
          );
        }
      })
      .catch((error) => {
        console.error("[mall-order] auto-close sweep failed", error && error.message ? error.message : error);
      });

  mallOrderAutoCloseTimer = setInterval(runSweep, intervalMs);

  if (typeof mallOrderAutoCloseTimer.unref === "function") {
    mallOrderAutoCloseTimer.unref();
  }

  runSweep();
}

async function syncMallRefundStatusByOrderId(orderId, options = {}) {
  const normalizedOrderId = normalizeString(orderId);
  if (!normalizedOrderId) {
    return {
      synced: false,
      order: null,
    };
  }

  const prismaClient = options.prismaClient || prisma;
  let order = options.order || null;

  if (!order) {
    order = await prismaClient.mallOrder.findUnique({
      where: {
        id: normalizedOrderId,
      },
      include: {
        items: true,
      },
    });
  }

  if (!order) {
    return {
      synced: false,
      order: null,
    };
  }

  const refundStatus = normalizeMallRefundStatus(order.refundStatus);
  const outRefundNo = normalizeString(order.refundOutRefundNo);
  if (refundStatus !== "PROCESSING" || !outRefundNo) {
    return {
      synced: false,
      order,
    };
  }

  try {
    const refundResult = await queryDomesticRefundByOutRefundNo({
      outRefundNo,
    });
    const nextRefundStatus = mapWechatRefundStatusToMallRefundStatus(refundResult.status);
    const nextWechatStatus = normalizeString(refundResult.status).toUpperCase();
    const shouldMarkRefunded = nextRefundStatus === "SUCCESS";
    const updateData = {
      refundStatus: nextRefundStatus,
      refundWechatStatus: nextWechatStatus || order.refundWechatStatus || "",
      refundWechatRefundId: normalizeString(refundResult.refundId) || order.refundWechatRefundId || "",
      refundUserReceivedAccount:
        normalizeString(refundResult.userReceivedAccount) || order.refundUserReceivedAccount || "",
      refundedAt: shouldMarkRefunded ? order.refundedAt || new Date() : order.refundedAt,
    };

    const updatedOrder = await prismaClient.mallOrder.update({
      where: {
        id: normalizedOrderId,
      },
      data: updateData,
      include: {
        items: true,
      },
    });

    return {
      synced: true,
      order: updatedOrder,
    };
  } catch (error) {
    return {
      synced: false,
      order,
    };
  }
}

async function settleMallRefundStatuses(input = {}) {
  const where = {
    refundStatus: "PROCESSING",
    refundOutRefundNo: {
      not: null,
    },
  };
  const orderId = normalizeString(input.orderId);
  const userId = normalizeString(input.userId);
  const shareSharerUserId = normalizeString(input.shareSharerUserId);
  const groupId = resolveMallStoreId(input);
  const limit = normalizeInteger(input.limit, { defaultValue: 20, min: 1, max: 200 });

  if (orderId) {
    where.id = orderId;
  }

  if (userId) {
    where.userId = userId;
  }

  if (shareSharerUserId) {
    where.shareSharerUserId = shareSharerUserId;
  }

  if (groupId) {
    where.groupId = groupId;
  }

  const orders = await prisma.mallOrder.findMany({
    where,
    include: {
      items: true,
    },
    orderBy: [{ updatedAt: "asc" }],
    take: limit,
  });

  let syncedCount = 0;

  for (const order of orders) {
    const result = await syncMallRefundStatusByOrderId(order.id, {
      order,
    });

    if (result.synced) {
      syncedCount += 1;
    }
  }

  return {
    syncedCount,
  };
}

async function receiveMallOrderById(orderId, options = {}) {
  const normalizedOrderId = normalizeString(orderId);
  let order = options.order || null;

  if (!normalizedOrderId) {
    return {
      updated: false,
      idempotent: false,
      order: null,
    };
  }

  if (!order) {
    order = await prisma.mallOrder.findUnique({
      where: {
        id: normalizedOrderId,
      },
      include: {
        items: true,
      },
    });
  }

  if (!order) {
    return {
      updated: false,
      idempotent: false,
      order: null,
    };
  }

  if (normalizeMallShippingStatus(order.shippingStatus) === "RECEIVED") {
    return {
      updated: false,
      idempotent: true,
      order,
    };
  }

  if (!canMallOrderConfirmReceipt(order)) {
    return {
      updated: false,
      idempotent: false,
      order,
    };
  }

  return prisma.$transaction(async (tx) => {
    const currentOrder = await tx.mallOrder.findUnique({
      where: {
        id: normalizedOrderId,
      },
      include: {
        items: true,
      },
    });

    if (!currentOrder) {
      return {
        updated: false,
        idempotent: false,
        order: null,
      };
    }

    if (normalizeMallShippingStatus(currentOrder.shippingStatus) === "RECEIVED") {
      return {
        updated: false,
        idempotent: true,
        order: currentOrder,
      };
    }

    if (!canMallOrderConfirmReceipt(currentOrder)) {
      return {
        updated: false,
        idempotent: false,
        order: currentOrder,
      };
    }

    const updateResult = await tx.mallOrder.updateMany({
      where: {
        id: currentOrder.id,
        status: "PAID",
        shippingStatus: "SHIPPED",
        refundStatus: {
          in: ["NONE", "REJECTED", "FAILED"],
        },
      },
      data: {
        shippingStatus: "RECEIVED",
        ...buildMallShareCommissionUpdate(currentOrder, "RECEIVED"),
      },
    });

    const latestOrder = await tx.mallOrder.findUnique({
      where: {
        id: currentOrder.id,
      },
      include: {
        items: true,
      },
    });

    if (!latestOrder) {
      return {
        updated: false,
        idempotent: false,
        order: currentOrder,
      };
    }

    if (updateResult.count === 1) {
      return {
        updated: true,
        idempotent: false,
        order: latestOrder,
      };
    }

    return {
      updated: false,
      idempotent: normalizeMallShippingStatus(latestOrder.shippingStatus) === "RECEIVED",
      order: latestOrder,
    };
  });
}

async function settleAutoReceivedMallOrders(input = {}) {
  const where = {
    status: "PAID",
    shippingStatus: "SHIPPED",
    refundStatus: {
      in: ["NONE", "REJECTED", "FAILED"],
    },
    shippedAt: {
      lte: getMallOrderAutoReceiveBefore(input.now || Date.now()),
    },
  };
  const orderId = normalizeString(input.orderId);
  const userId = normalizeString(input.userId);
  const shareSharerUserId = normalizeString(input.shareSharerUserId);
  const groupId = resolveMallStoreId(input);
  const limit = normalizeInteger(input.limit, { defaultValue: 20, min: 1, max: 200 });

  if (orderId) {
    where.id = orderId;
  }

  if (userId) {
    where.userId = userId;
  }

  if (shareSharerUserId) {
    where.shareSharerUserId = shareSharerUserId;
  }

  if (groupId) {
    where.groupId = groupId;
  }

  const autoReceivableOrders = await prisma.mallOrder.findMany({
    where,
    include: {
      items: true,
    },
    orderBy: [{ shippedAt: "asc" }, { updatedAt: "asc" }],
    take: limit,
  });

  let receivedCount = 0;

  for (const order of autoReceivableOrders) {
    if (!isMallOrderAutoReceivable(order, input.now || Date.now())) {
      continue;
    }

    const result = await receiveMallOrderById(order.id, {
      order,
    });

    if (result.updated) {
      receivedCount += 1;
    }
  }

  return {
    receivedCount,
  };
}

function startMallOrderAutoReceiveScheduler() {
  if (mallOrderAutoReceiveTimer) {
    return;
  }

  const intervalMs = resolveMallOrderAutoReceiveIntervalMs();
  const runSweep = () =>
    settleAutoReceivedMallOrders({
      limit: 50,
    })
      .then((result) => {
        if (result.receivedCount) {
          console.log(
            `[mall-order] auto-receive settled received=${result.receivedCount} window=${resolveMallOrderAutoReceiveDays()}d`
          );
        }
      })
      .catch((error) => {
        console.error("[mall-order] auto-receive sweep failed", error && error.message ? error.message : error);
      });

  mallOrderAutoReceiveTimer = setInterval(runSweep, intervalMs);

  if (typeof mallOrderAutoReceiveTimer.unref === "function") {
    mallOrderAutoReceiveTimer.unref();
  }

  runSweep();
}

async function prepareMallOrderPayment(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const orderId = normalizeString(input.orderId);
  if (!orderId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少订单ID",
      },
    };
  }

  await settleExpiredMallOrders({
    orderId,
    userId: sessionResult.session.userId,
    limit: 1,
  });

  let order = await prisma.mallOrder.findFirst({
    where: {
      id: orderId,
      userId: sessionResult.session.userId,
    },
    include: {
      items: true,
    },
  });

  if (!order) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "订单不存在",
      },
    };
  }

  if (order.status === "CLOSED") {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: "订单已关闭，不能继续支付",
      },
    };
  }

  if (order.status === "PENDING" && (await trySyncMallWechatPaymentStatus(order))) {
    order = await prisma.mallOrder.findUnique({
      where: {
        id: order.id,
      },
      include: {
        items: true,
      },
    });
  }

  if (!order) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "订单不存在",
      },
    };
  }

  if (order.status === "PAID") {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          order: buildMallOrderPayload(order),
          payment: buildMallPaymentPayload(order),
        },
      },
    };
  }

  const payment = await createMallWechatPaymentRequest({
    order,
    user: sessionResult.session.user,
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        order: buildMallOrderPayload(order),
        payment: buildMallPaymentPayload(order, {
          request: payment.request,
        }),
      },
    },
  };
}

function buildMallShippingAddressPayload(address) {
  if (!address) {
    return null;
  }

  return {
    id: address.id,
    userId: address.userId,
    recipientName: address.recipientName,
    phone: address.phone,
    province: address.province,
    city: address.city,
    district: address.district,
    detailAddress: address.detailAddress,
    isDefault: Boolean(address.isDefault),
    fullAddress: buildMallShippingAddressFullAddress(address),
    createdAt: toIso(address.createdAt),
    updatedAt: toIso(address.updatedAt),
  };
}

function resolveDefaultMallShippingAddress(addresses) {
  if (!Array.isArray(addresses) || !addresses.length) {
    return null;
  }

  return addresses.find((item) => Boolean(item && item.isDefault)) || addresses[0] || null;
}

function buildMallShippingAddressCollectionPayload(addresses, options = {}) {
  const items = Array.isArray(addresses) ? addresses.map(buildMallShippingAddressPayload) : [];
  const defaultAddress = resolveDefaultMallShippingAddress(addresses);
  const selectedAddress =
    options && options.selectedAddressId
      ? addresses.find((item) => item.id === options.selectedAddressId) || defaultAddress
      : defaultAddress;

  return {
    item: buildMallShippingAddressPayload(defaultAddress),
    defaultItem: buildMallShippingAddressPayload(defaultAddress),
    selectedItem: buildMallShippingAddressPayload(selectedAddress),
    items,
  };
}

async function listMallShippingAddressesByUser(userId, prismaClient = prisma) {
  return prismaClient.mallShippingAddress.findMany({
    where: {
      userId,
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

async function ensureSingleDefaultMallShippingAddress(userId, prismaClient = prisma) {
  const addresses = await listMallShippingAddressesByUser(userId, prismaClient);
  const defaultAddress = resolveDefaultMallShippingAddress(addresses);

  if (!defaultAddress) {
    return addresses;
  }

  if (!defaultAddress.isDefault) {
    await prismaClient.mallShippingAddress.update({
      where: {
        id: defaultAddress.id,
      },
      data: {
        isDefault: true,
      },
    });
    return listMallShippingAddressesByUser(userId, prismaClient);
  }

  const duplicatedDefaultIds = addresses.filter((item) => item.id !== defaultAddress.id && item.isDefault).map((item) => item.id);
  if (duplicatedDefaultIds.length) {
    await prismaClient.mallShippingAddress.updateMany({
      where: {
        id: {
          in: duplicatedDefaultIds,
        },
      },
      data: {
        isDefault: false,
      },
    });
    return listMallShippingAddressesByUser(userId, prismaClient);
  }

  return addresses;
}

function buildMallProductReviewPayload(review) {
  const userProfile = review.user && review.user.profile ? review.user.profile : null;
  const isAnonymous = Boolean(review.isAnonymous);

  return {
    id: review.id,
    productId: review.productId,
    userId: review.userId,
    rating: review.rating,
    content: review.content,
    isAnonymous,
    nickname: isAnonymous
      ? "匿名用户"
      : userProfile && userProfile.nickname
        ? userProfile.nickname
        : `用户${String(review.userId || "").slice(-4)}`,
    avatarUrl: isAnonymous ? "" : userProfile && userProfile.avatarUrl ? userProfile.avatarUrl : "",
    createdAt: toIso(review.createdAt),
    updatedAt: toIso(review.updatedAt),
  };
}

function buildMallProductReviewSummary(reviewCount, averageRating, positiveCount) {
  const safeReviewCount = Number(reviewCount || 0);
  const safePositiveCount = Number(positiveCount || 0);
  const safeAverageRating = safeReviewCount > 0 ? Math.round(Number(averageRating || 0) * 10) / 10 : 0;
  const safePositiveRate = safeReviewCount > 0 ? Math.round((safePositiveCount / safeReviewCount) * 100) : 0;

  return {
    reviewCount: safeReviewCount,
    averageRating: safeAverageRating,
    averageRatingText: safeAverageRating.toFixed(1),
    positiveCount: safePositiveCount,
    positiveRate: safePositiveRate,
    positiveRateText: `${safePositiveRate}%`,
  };
}

function buildOrderNo() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");

  return `M${stamp}${Math.random().toString().slice(2, 6)}`;
}

async function findMallShareableProduct(productId) {
  const normalizedProductId = normalizeString(productId);
  if (!normalizedProductId) {
    return null;
  }

  return prisma.mallProduct.findFirst({
    where: {
      id: normalizedProductId,
      isOnSale: true,
      category: {
        is: {
          isEnabled: true,
        },
      },
      group: {
        is: {
          status: {
            in: DEFAULT_GROUP_STATUSES,
          },
        },
      },
    },
    include: {
      category: true,
      group: true,
    },
  });
}

async function createMallProductShareToken(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const productId = normalizeString(input.productId);
  if (!productId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商品ID",
      },
    };
  }

  const product = await findMallShareableProduct(productId);
  if (!product) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "商品不存在或已下架",
      },
    };
  }

  const shareToken = buildMallShareToken({
    storeId: product.groupId,
    productId: product.id,
    sharerUserId: sessionResult.session.userId,
  });
  const estimatedCommission = calculateMallShareCommissionAmount(product.price, 1);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        productId: product.id,
        storeId: product.groupId,
        shareToken,
        sharerUserId: sessionResult.session.userId,
        estimatedCommission,
        estimatedCommissionText: formatMoney(estimatedCommission),
        commissionRate: DEFAULT_MALL_SHARE_COMMISSION_RATE,
        commissionRateText: formatPercent(DEFAULT_MALL_SHARE_COMMISSION_RATE),
      },
    },
  };
}

function resolveMallOrderShareAttribution(input = {}) {
  const normalizedShareToken = normalizeString(input.shareToken);
  if (!normalizedShareToken) {
    return { attribution: null };
  }

  const parsedShareToken = parseMallShareToken(normalizedShareToken);
  if (!parsedShareToken) {
    return {
      error: {
        statusCode: 400,
        payload: {
          ok: false,
          message: "分享信息无效，请重新打开商品后再下单",
        },
      },
    };
  }

  if (parsedShareToken.sharerUserId === normalizeString(input.userId)) {
    return { attribution: null };
  }

  const cartItems = Array.isArray(input.cartItems) ? input.cartItems : [];
  const sharedCartItems = cartItems.filter(
    (cartItem) =>
      normalizeString(cartItem.productId) === parsedShareToken.productId &&
      normalizeString(cartItem.product && cartItem.product.groupId) === parsedShareToken.storeId
  );

  if (!sharedCartItems.length) {
    return { attribution: null };
  }

  const resolveCartItemEffectivePrice = (cartItem) => {
    if (cartItem && cartItem.purchaseState) {
      return normalizeMoneyNumber(cartItem.purchaseState.effectivePrice, { defaultValue: 0, min: 0 });
    }

    return normalizeMoneyNumber(cartItem && cartItem.product && cartItem.product.price, {
      defaultValue: 0,
      min: 0,
    });
  };

  const shareCommissionBaseAmount = normalizeMoneyNumber(
    sharedCartItems.reduce((total, cartItem) => total + resolveCartItemEffectivePrice(cartItem) * cartItem.quantity, 0)
  );
  const shareCommissionAmount = normalizeMoneyNumber(
    sharedCartItems.reduce(
      (total, cartItem) =>
        total + calculateMallShareCommissionAmount(resolveCartItemEffectivePrice(cartItem), cartItem.quantity),
      0
    )
  );

  if (shareCommissionAmount <= 0 || shareCommissionBaseAmount <= 0) {
    return { attribution: null };
  }

  return {
    attribution: {
      shareSharerUserId: parsedShareToken.sharerUserId,
      shareProductId: parsedShareToken.productId,
      shareCommissionRate: DEFAULT_MALL_SHARE_COMMISSION_RATE,
      shareCommissionBaseAmount,
      shareCommissionAmount,
      shareCommissionStatus: "PENDING",
    },
  };
}

async function getCategoryProductCountMap(groupId, includeOffSale = false) {
  const rows = await prisma.mallProduct.groupBy({
    by: ["categoryId"],
    where: {
      groupId,
      ...(includeOffSale ? {} : { isOnSale: true }),
    },
    _count: {
      _all: true,
    },
  });

  return rows.reduce((map, row) => {
    map.set(row.categoryId, row._count._all);
    return map;
  }, new Map());
}

async function listMallCategories(input = {}) {
  const groupResult = await requireMallGroup(input);
  if (groupResult.error) {
    return groupResult.error;
  }

  const { group } = groupResult;
  const [categories, productCountMap] = await Promise.all([
    prisma.mallCategory.findMany({
      where: {
        groupId: group.id,
        isEnabled: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    getCategoryProductCountMap(group.id),
  ]);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        storeId: group.id,
        storeName: group.name,
        items: categories.map((category) => buildCategoryPayload(category, productCountMap)),
      },
    },
  };
}

async function listMallProducts(input = {}) {
  const categoryId = normalizeString(input.categoryId);
  const keyword = normalizeString(input.keyword);
  const groupResult = await requireMallGroup(input);
  if (groupResult.error) {
    return groupResult.error;
  }

  const { group } = groupResult;
  const session = await getActiveSession(input.sessionToken);
  const userId = session ? session.userId : "";

  const [products, cartItems, membershipSummaryMap] = await Promise.all([
    prisma.mallProduct.findMany({
      where: {
        groupId: group.id,
        isOnSale: true,
        ...(categoryId ? { categoryId } : {}),
        category: {
          is: {
            isEnabled: true,
          },
        },
        ...(keyword
          ? {
              OR: [
                {
                  title: {
                    contains: keyword,
                    mode: "insensitive",
                  },
                },
                {
                  subtitle: {
                    contains: keyword,
                    mode: "insensitive",
                  },
                },
                {
                  category: {
                    is: {
                      isEnabled: true,
                      name: {
                        contains: keyword,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        category: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    userId
      ? prisma.mallCartItem.findMany({
          where: { userId },
          select: {
            productId: true,
            quantity: true,
          },
        })
      : Promise.resolve([]),
    getMallMembershipSummaryMap([group.id], userId),
  ]);

  const cartQuantityMap = cartItems.reduce((map, item) => {
    map.set(item.productId, item.quantity);
    return map;
  }, new Map());

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        storeId: group.id,
        storeName: group.name,
        categoryId,
        keyword,
        items: products.map((product) =>
          buildProductPayload(product, {
            cartQuantityMap,
            membershipSummaryMap,
            resolveMembership: true,
          })
        ),
      },
    },
  };
}

async function getMallProductDetail(input = {}) {
  const productId = normalizeString(input.productId);
  if (!productId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商品ID",
      },
    };
  }

  const session = await getActiveSession(input.sessionToken);
  const [product, cartItem] = await Promise.all([
    prisma.mallProduct.findFirst({
      where: {
        id: productId,
        category: {
          is: {
            isEnabled: true,
          },
        },
      },
      include: {
        category: true,
        detailImages: {
          where: {
            isEnabled: true,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
    session
      ? prisma.mallCartItem.findUnique({
          where: {
            userId_productId: {
              userId: session.userId,
              productId,
            },
          },
          select: {
            quantity: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (!product || !product.isOnSale) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "商品不存在或已下架",
      },
    };
  }

  const cartQuantityMap = new Map();
  if (cartItem) {
    cartQuantityMap.set(product.id, cartItem.quantity);
  }
  const membershipSummaryMap = await getMallMembershipSummaryMap([product.groupId], session ? session.userId : "");

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        item: buildProductPayload(product, {
          cartQuantityMap,
          membershipSummaryMap,
          resolveMembership: true,
        }),
      },
    },
  };
}

async function listMallProductReviews(input = {}) {
  const productId = normalizeString(input.productId);
  const limit = normalizeInteger(input.limit, { defaultValue: 20, min: 1, max: 50 });

  if (!productId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商品ID",
      },
    };
  }

  const session = await getActiveSession(input.sessionToken);
  const userId = session ? session.userId : "";
  const [product, reviews, aggregateResult, positiveCount, currentUserReview] = await Promise.all([
    prisma.mallProduct.findFirst({
      where: {
        id: productId,
        category: {
          is: {
            isEnabled: true,
          },
        },
      },
      select: {
        id: true,
      },
    }),
    prisma.mallProductReview.findMany({
      where: {
        productId,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
    prisma.mallProductReview.aggregate({
      where: {
        productId,
      },
      _count: {
        _all: true,
      },
      _avg: {
        rating: true,
      },
    }),
    prisma.mallProductReview.count({
      where: {
        productId,
        rating: {
          gte: 4,
        },
      },
    }),
    userId
      ? prisma.mallProductReview.findUnique({
          where: {
            userId_productId: {
              userId,
              productId,
            },
          },
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  if (!product) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "商品不存在",
      },
    };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        summary: buildMallProductReviewSummary(
          aggregateResult && aggregateResult._count ? aggregateResult._count._all : 0,
          aggregateResult && aggregateResult._avg ? aggregateResult._avg.rating : 0,
          positiveCount,
        ),
        items: reviews.map(buildMallProductReviewPayload),
        currentUserReview: currentUserReview ? buildMallProductReviewPayload(currentUserReview) : null,
      },
    },
  };
}

async function createMallProductReview(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;
  const productId = normalizeString(input.productId);
  const rating = normalizeInteger(input.rating, { defaultValue: 5, min: 1, max: 5 });
  const content = normalizeString(input.content).replace(/\s+/g, " ");
  const isAnonymous = normalizeBoolean(input.isAnonymous, false);

  if (!productId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商品ID",
      },
    };
  }

  if (content.length < 2) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "评价内容至少 2 个字",
      },
    };
  }

  if (content.length > 200) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "评价内容不能超过 200 个字",
      },
    };
  }

  const product = await prisma.mallProduct.findFirst({
    where: {
      id: productId,
      category: {
        is: {
          isEnabled: true,
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!product) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "商品不存在",
      },
    };
  }

  const existingReview = await prisma.mallProductReview.findUnique({
    where: {
      userId_productId: {
        userId: session.userId,
        productId,
      },
    },
    select: {
      id: true,
    },
  });

  const review = existingReview
    ? await prisma.mallProductReview.update({
        where: {
          id: existingReview.id,
        },
        data: {
          rating,
          content,
          isAnonymous,
        },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      })
    : await prisma.mallProductReview.create({
        data: {
          productId,
          userId: session.userId,
          rating,
          content,
          isAnonymous,
        },
        include: {
          user: {
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
      data: {
        item: buildMallProductReviewPayload(review),
        updated: Boolean(existingReview),
      },
    },
  };
}

async function getMallShippingAddress(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const addresses = await ensureSingleDefaultMallShippingAddress(sessionResult.session.userId);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildMallShippingAddressCollectionPayload(addresses),
    },
  };
}

async function upsertMallShippingAddress(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const addressId = normalizeString(input.addressId);
  const createNew = normalizeBoolean(input.createNew, false);
  const recipientName = normalizeString(input.recipientName);
  const phone = normalizePhone(input.phone);
  const province = normalizeString(input.province);
  const city = normalizeString(input.city);
  const district = normalizeString(input.district);
  const detailAddress = normalizeString(input.detailAddress);
  const userId = sessionResult.session.userId;

  if (!recipientName) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "请填写收货人姓名",
      },
    };
  }

  if (!/^1\d{10}$/.test(phone)) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "请输入正确的手机号",
      },
    };
  }

  if (!province || !city || !district) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "请完整选择省市区",
      },
    };
  }

  if (!detailAddress) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "请填写详细地址",
      },
    };
  }

  const existingAddresses = await ensureSingleDefaultMallShippingAddress(userId);
  const fallbackAddress = createNew ? null : resolveDefaultMallShippingAddress(existingAddresses);
  const targetAddress = addressId
    ? existingAddresses.find((item) => item.id === addressId) || null
    : fallbackAddress;

  if (addressId && !targetAddress) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "收货地址不存在",
      },
    };
  }

  const shouldCreate = !targetAddress;
  const requestedDefault = Object.prototype.hasOwnProperty.call(input, "isDefault")
    ? normalizeBoolean(input.isDefault, false)
    : null;

  const nextAddresses = await prisma.$transaction(async (tx) => {
    const shouldBeDefault =
      requestedDefault === null
        ? shouldCreate
          ? existingAddresses.length === 0
          : Boolean(targetAddress && targetAddress.isDefault)
        : Boolean(requestedDefault);

    if (shouldBeDefault) {
      await tx.mallShippingAddress.updateMany({
        where: {
          userId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const savedAddress = shouldCreate
      ? await tx.mallShippingAddress.create({
          data: {
            userId,
            recipientName,
            phone,
            province,
            city,
            district,
            detailAddress,
            isDefault: shouldBeDefault,
          },
        })
      : await tx.mallShippingAddress.update({
          where: {
            id: targetAddress.id,
          },
          data: {
            recipientName,
            phone,
            province,
            city,
            district,
            detailAddress,
            isDefault: shouldBeDefault,
          },
        });

    let addresses = await listMallShippingAddressesByUser(userId, tx);
    if (!addresses.some((item) => item.isDefault)) {
      await tx.mallShippingAddress.update({
        where: {
          id: savedAddress.id,
        },
        data: {
          isDefault: true,
        },
      });
      addresses = await listMallShippingAddressesByUser(userId, tx);
    }

    return {
      addresses,
      savedAddressId: savedAddress.id,
    };
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        ...buildMallShippingAddressCollectionPayload(nextAddresses.addresses, {
          selectedAddressId: nextAddresses.savedAddressId,
        }),
        savedItem:
          buildMallShippingAddressCollectionPayload(nextAddresses.addresses, {
            selectedAddressId: nextAddresses.savedAddressId,
          }).selectedItem,
      },
    },
  };
}

async function setDefaultMallShippingAddress(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const addressId = normalizeString(input.addressId);
  if (!addressId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少收货地址ID",
      },
    };
  }

  const userId = sessionResult.session.userId;

  const nextAddresses = await prisma.$transaction(async (tx) => {
    const existingAddress = await tx.mallShippingAddress.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });

    if (!existingAddress) {
      return null;
    }

    await tx.mallShippingAddress.updateMany({
      where: {
        userId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    await tx.mallShippingAddress.update({
      where: {
        id: addressId,
      },
      data: {
        isDefault: true,
      },
    });

    return listMallShippingAddressesByUser(userId, tx);
  });

  if (!nextAddresses) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "收货地址不存在",
      },
    };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildMallShippingAddressCollectionPayload(nextAddresses, {
        selectedAddressId: addressId,
      }),
    },
  };
}

async function deleteMallShippingAddress(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const addressId = normalizeString(input.addressId);
  if (!addressId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少收货地址ID",
      },
    };
  }

  const userId = sessionResult.session.userId;

  const nextAddresses = await prisma.$transaction(async (tx) => {
    const existingAddress = await tx.mallShippingAddress.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });

    if (!existingAddress) {
      return null;
    }

    await tx.mallShippingAddress.delete({
      where: {
        id: addressId,
      },
    });

    let addresses = await listMallShippingAddressesByUser(userId, tx);
    if (existingAddress.isDefault && addresses.length && !addresses.some((item) => item.isDefault)) {
      await tx.mallShippingAddress.update({
        where: {
          id: addresses[0].id,
        },
        data: {
          isDefault: true,
        },
      });
      addresses = await listMallShippingAddressesByUser(userId, tx);
    }

    return addresses;
  });

  if (!nextAddresses) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "收货地址不存在",
      },
    };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        ...buildMallShippingAddressCollectionPayload(nextAddresses),
        removedAddressId: addressId,
      },
    },
  };
}

async function getMallCartItemsByUser(userId) {
  return prisma.mallCartItem.findMany({
    where: { userId },
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

async function listMallCart(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const cartItems = await getMallCartItemsByUser(sessionResult.session.userId);
  const membershipSummaryMap = await getMallMembershipSummaryMap(
    cartItems.map((item) => item.product && item.product.groupId),
    sessionResult.session.userId
  );

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildCartPayload(cartItems, {
        membershipSummaryMap,
      }),
    },
  };
}

async function ensureMallProductAvailable(productId) {
  const product = await prisma.mallProduct.findUnique({
    where: { id: productId },
    include: {
      category: true,
    },
  });

  if (!product || !product.category || !product.category.isEnabled || !product.isOnSale) {
    return {
      error: {
        statusCode: 404,
        payload: {
          ok: false,
          message: "商品不存在或已下架",
        },
      },
    };
  }

  return { product };
}

async function addMallCartItem(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const productId = normalizeString(input.productId);
  const quantity = normalizeInteger(input.quantity, { defaultValue: 1, min: 1, max: 99 });
  if (!productId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商品ID",
      },
    };
  }

  const productResult = await ensureMallProductAvailable(productId);
  if (productResult.error) {
    return productResult.error;
  }

  const { product } = productResult;
  const userId = sessionResult.session.userId;
  const membershipSummaryMap = await getMallMembershipSummaryMap([product.groupId], userId);
  const benefitState = resolveMallProductBenefitState(product, {
    resolveMembership: true,
    membershipSummary: getMallMembershipSummaryByGroupId(membershipSummaryMap, product.groupId),
  });
  if (!benefitState.canPurchase) {
    return buildMallMemberExclusivePurchaseError(product);
  }
  const existingCartItem = await prisma.mallCartItem.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });

  const nextQuantity = (existingCartItem ? existingCartItem.quantity : 0) + quantity;
  if (nextQuantity > product.stock) {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: `库存不足，当前仅剩 ${product.stock} 件`,
      },
    };
  }

  await prisma.mallCartItem.upsert({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
    create: {
      userId,
      productId,
      quantity,
    },
    update: {
      quantity: nextQuantity,
    },
  });

  return listMallCart({
    sessionToken: input.sessionToken,
  });
}

async function updateMallCartItem(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const productId = normalizeString(input.productId);
  const quantity = normalizeInteger(input.quantity, { defaultValue: 1, min: 0, max: 99 });
  if (!productId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商品ID",
      },
    };
  }

  if (quantity <= 0) {
    return deleteMallCartItem({
      sessionToken: input.sessionToken,
      productId,
    });
  }

  const productResult = await ensureMallProductAvailable(productId);
  if (productResult.error) {
    return productResult.error;
  }

  const { product } = productResult;
  const membershipSummaryMap = await getMallMembershipSummaryMap([product.groupId], sessionResult.session.userId);
  const benefitState = resolveMallProductBenefitState(product, {
    resolveMembership: true,
    membershipSummary: getMallMembershipSummaryByGroupId(membershipSummaryMap, product.groupId),
  });
  if (!benefitState.canPurchase) {
    return buildMallMemberExclusivePurchaseError(product);
  }
  if (quantity > product.stock) {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: `库存不足，当前仅剩 ${product.stock} 件`,
      },
    };
  }

  await prisma.mallCartItem.upsert({
    where: {
      userId_productId: {
        userId: sessionResult.session.userId,
        productId,
      },
    },
    create: {
      userId: sessionResult.session.userId,
      productId,
      quantity,
    },
    update: {
      quantity,
    },
  });

  return listMallCart({
    sessionToken: input.sessionToken,
  });
}

async function deleteMallCartItem(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const productId = normalizeString(input.productId);
  if (!productId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商品ID",
      },
    };
  }

  await prisma.mallCartItem.deleteMany({
    where: {
      userId: sessionResult.session.userId,
      productId,
    },
  });

  return listMallCart({
    sessionToken: input.sessionToken,
  });
}

async function clearMallCart(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  await prisma.mallCartItem.deleteMany({
    where: {
      userId: sessionResult.session.userId,
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        cartCount: 0,
        totalAmount: 0,
        totalAmountText: "0.00",
        items: [],
      },
    },
  };
}

function buildMallDirectOrderSourceItem(product, quantity) {
  return {
    id: `direct_${product.id}`,
    productId: product.id,
    quantity,
    product,
  };
}

async function createMallOrder(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const remark = normalizeString(input.remark);
  const couponCode = normalizeString(input.couponCode);
  const shareToken = normalizeString(input.shareToken);
  const addressId = normalizeString(input.addressId);
  const productId = normalizeString(input.productId);
  const directQuantity = normalizeInteger(input.quantity, { defaultValue: 1, min: 1, max: 99 });
  const isDirectOrder = Boolean(productId);
  const userId = sessionResult.session.userId;

  await settleExpiredMallOrders({
    limit: 50,
  });

  const [cartItems, directProductResult, shippingAddress] = await Promise.all([
    isDirectOrder ? Promise.resolve([]) : getMallCartItemsByUser(userId),
    isDirectOrder ? ensureMallProductAvailable(productId) : Promise.resolve(null),
    addressId
      ? prisma.mallShippingAddress.findFirst({
          where: {
            id: addressId,
            userId,
          },
        })
      : prisma.mallShippingAddress.findFirst({
          where: {
            userId,
          },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        }),
  ]);

  if (directProductResult && directProductResult.error) {
    return directProductResult.error;
  }

  const sourceItems = isDirectOrder
    ? [buildMallDirectOrderSourceItem(directProductResult.product, directQuantity)]
    : cartItems;

  if (!sourceItems.length) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: isDirectOrder ? "缺少可下单商品" : "购物车还是空的",
      },
    };
  }

  if (!shippingAddress) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "请先填写收货地址",
      },
    };
  }

  const distinctGroupIds = Array.from(new Set(sourceItems.map((item) => item.product.groupId)));
  if (distinctGroupIds.length !== 1) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "购物车中包含多个商家商品，请拆分后再下单",
      },
    };
  }

  const membershipSummaryMap = await getMallMembershipSummaryMap(distinctGroupIds, userId);
  const resolvedSourceItems = sourceItems.map((cartItem) => ({
    ...cartItem,
    purchaseState: resolveMallProductBenefitState(cartItem.product, {
      resolveMembership: true,
      membershipSummary: getMallMembershipSummaryByGroupId(membershipSummaryMap, cartItem.product && cartItem.product.groupId),
    }),
  }));

  for (const cartItem of resolvedSourceItems) {
    const product = cartItem.product;
    if (!product.isOnSale || !product.category || !product.category.isEnabled) {
      return {
        statusCode: 409,
        payload: {
          ok: false,
          message: `商品「${product.title}」已下架，请刷新后重试`,
        },
      };
    }

    if (!cartItem.purchaseState.canPurchase) {
      return buildMallMemberExclusivePurchaseError(product);
    }

    if (cartItem.quantity > product.stock) {
      return {
        statusCode: 409,
        payload: {
          ok: false,
          message: `商品「${product.title}」库存不足`,
        },
      };
    }
  }

  const totalAmount = resolvedSourceItems.reduce(
    (sum, item) => sum + toMoneyNumber(item.purchaseState && item.purchaseState.effectivePrice) * item.quantity,
    0
  );
  const memberDiscountAmount = resolvedSourceItems.reduce((sum, item) => {
    const publicPrice = toMoneyNumber(item.purchaseState && item.purchaseState.publicPrice);
    const effectivePrice = toMoneyNumber(item.purchaseState && item.purchaseState.effectivePrice);
    return sum + Math.max(publicPrice - effectivePrice, 0) * item.quantity;
  }, 0);
  const publicAmount = normalizeMoneyNumber(totalAmount + memberDiscountAmount, {
    defaultValue: totalAmount,
    min: 0,
  });
  const memberPriceItemCount = resolvedSourceItems.reduce(
    (sum, item) =>
      sum + (item.purchaseState && item.purchaseState.memberBenefitType === MALL_MEMBER_BENEFIT_MEMBER_PRICE ? item.quantity : 0),
    0
  );
  const memberExclusiveItemCount = resolvedSourceItems.reduce(
    (sum, item) =>
      sum +
      (item.purchaseState && item.purchaseState.memberBenefitType === MALL_MEMBER_BENEFIT_MEMBER_EXCLUSIVE ? item.quantity : 0),
    0
  );
  const couponSelection = couponCode
    ? await (async () => {
        const paidOrderCount = await getMallPaidOrderCountByClient(prisma, distinctGroupIds[0], userId);
        const requestedCoupon = await prisma.coupon.findUnique({
          where: {
            code: couponCode,
          },
        });
        const resolvedCoupon = resolveMallPromotionCoupon(requestedCoupon, distinctGroupIds[0]);
        if (!resolvedCoupon.coupon) {
          return {
            error: {
              statusCode: 409,
              payload: {
                ok: false,
                message: resolvedCoupon.message,
              },
            },
          };
        }

        const eligibility = resolveMallCouponUserEligibility(resolvedCoupon.coupon, paidOrderCount);
        if (!eligibility.ok) {
          return {
            error: {
              statusCode: 409,
              payload: {
                ok: false,
                message: eligibility.message,
              },
            },
          };
        }

        return {
          coupon: resolvedCoupon.coupon,
          discountAmount: getMallCouponDiscountAmount(resolvedCoupon.coupon, totalAmount),
        };
      })()
    : await (async () => {
        const couponResult = await listEligibleMallCouponsByClient(prisma, distinctGroupIds[0], userId);
        return pickBestMallCoupon(couponResult.items, totalAmount);
      })();

  if (couponSelection && couponSelection.error) {
    return couponSelection.error;
  }

  const activeCoupon = couponSelection ? couponSelection.coupon : null;
  const discountAmount = normalizeMoneyNumber(couponSelection ? couponSelection.discountAmount : 0, {
    defaultValue: 0,
    min: 0,
  });
  const payableAmount = normalizeMoneyNumber(totalAmount - discountAmount, { defaultValue: totalAmount, min: 0 });
  const couponMeta = buildMallOrderCouponMeta(activeCoupon, totalAmount);
  const pricingMeta = buildMallOrderPricingMeta({
    publicAmount,
    orderAmount: totalAmount,
    memberDiscountAmount,
    couponDiscountAmount: discountAmount,
    payableAmount,
    memberPriceItemCount,
    memberExclusiveItemCount,
  });
  const storedRemark = buildMallOrderStoredRemark(remark, couponMeta, pricingMeta);
  const initialOrderStatus = payableAmount <= 0 ? "PAID" : "PENDING";
  const orderNo = buildOrderNo();
  const shareAttributionResult = resolveMallOrderShareAttribution({
    shareToken,
    userId,
    cartItems: resolvedSourceItems,
  });

  if (shareAttributionResult.error) {
    return shareAttributionResult.error;
  }

  const shareAttribution = shareAttributionResult.attribution;

  try {
    const order = await prisma.$transaction(async (tx) => {
      for (const cartItem of resolvedSourceItems) {
        const updateResult = await tx.mallProduct.updateMany({
          where: {
            id: cartItem.productId,
            stock: {
              gte: cartItem.quantity,
            },
          },
          data: {
            stock: {
              decrement: cartItem.quantity,
            },
          },
        });

        if (updateResult.count !== 1) {
          const stockError = new Error(`商品「${cartItem.product.title}」库存不足，请刷新后重试`);
          stockError.code = "MALL_STOCK_CONFLICT";
          throw stockError;
        }
      }

      const createdOrder = await tx.mallOrder.create({
        data: {
          orderNo,
          groupId: distinctGroupIds[0],
          userId,
          status: initialOrderStatus,
          totalAmount: totalAmount.toFixed(2),
          payableAmount: payableAmount.toFixed(2),
          remark: storedRemark || null,
          shareSharerUserId: shareAttribution ? shareAttribution.shareSharerUserId : null,
          shareProductId: shareAttribution ? shareAttribution.shareProductId : null,
          shareCommissionRate: shareAttribution ? shareAttribution.shareCommissionRate.toFixed(4) : null,
          shareCommissionBaseAmount: shareAttribution ? shareAttribution.shareCommissionBaseAmount.toFixed(2) : null,
          shareCommissionAmount: shareAttribution ? shareAttribution.shareCommissionAmount.toFixed(2) : null,
          shareCommissionStatus: shareAttribution ? shareAttribution.shareCommissionStatus : "NONE",
          shareCommissionSettledAt: null,
          shippingRecipientName: shippingAddress.recipientName,
          shippingRecipientPhone: shippingAddress.phone,
          shippingProvince: shippingAddress.province,
          shippingCity: shippingAddress.city,
          shippingDistrict: shippingAddress.district,
          shippingDetailAddress: shippingAddress.detailAddress,
          shippingStatus: "PENDING",
          shippingCompany: "",
          shippingTrackingNo: "",
          shippingRemark: "",
          shippedAt: null,
          items: {
            create: resolvedSourceItems.map((cartItem) => ({
              productId: cartItem.productId,
              productTitle: cartItem.product.title,
              productSubtitle: cartItem.product.subtitle || null,
              coverImageUrl: cartItem.product.coverImageUrl || null,
              unitPrice: toMoneyNumber(cartItem.purchaseState && cartItem.purchaseState.effectivePrice).toFixed(2),
              quantity: cartItem.quantity,
              totalAmount: (
                toMoneyNumber(cartItem.purchaseState && cartItem.purchaseState.effectivePrice) * cartItem.quantity
              ).toFixed(2),
            })),
          },
        },
        include: {
          items: true,
        },
      });

      if (initialOrderStatus === "PAID" && activeCoupon) {
        await consumeMallOrderCouponUsage(tx, createdOrder);
      }

      if (!isDirectOrder) {
        await tx.mallCartItem.deleteMany({
          where: {
            userId,
          },
        });
      }

      return createdOrder;
    });

    let paymentRequest = null;
    let paymentErrorMessage = "";

    if (order.status === "PENDING") {
      try {
        const payment = await createMallWechatPaymentRequest({
          order,
          user: sessionResult.session.user,
        });
        paymentRequest = payment.request;
      } catch (error) {
        paymentErrorMessage = error && error.message ? error.message : "支付参数准备失败";
      }
    }

    return {
      statusCode: 201,
      payload: {
        ok: true,
        data: {
          order: buildMallOrderPayload(order),
          payment: buildMallPaymentPayload(order, {
            request: paymentRequest,
            errorMessage: paymentErrorMessage,
          }),
        },
      },
    };
  } catch (error) {
    if (error && error.code === "MALL_STOCK_CONFLICT") {
      return {
        statusCode: 409,
        payload: {
          ok: false,
          message: error.message,
        },
      };
    }

    throw error;
  }
}

async function listMallOrders(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  await settleExpiredMallOrders({
    userId: sessionResult.session.userId,
    limit: 50,
  });
  await settleMallRefundStatuses({
    userId: sessionResult.session.userId,
    limit: 50,
  });
  await settleAutoReceivedMallOrders({
    userId: sessionResult.session.userId,
    limit: 50,
  });

  const orders = await prisma.mallOrder.findMany({
    where: {
      userId: sessionResult.session.userId,
    },
    include: {
      items: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });
  const shareUserMap = await buildMallShareUserSummaryMap(orders);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        items: orders.map((order) => buildMallOrderPayload(order, { shareUserMap })),
      },
    },
  };
}

async function getMallOrderDetail(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const orderId = normalizeString(input.orderId);
  if (!orderId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少订单ID",
      },
    };
  }

  await settleExpiredMallOrders({
    orderId,
    userId: sessionResult.session.userId,
    limit: 1,
  });
  await settleMallRefundStatuses({
    orderId,
    userId: sessionResult.session.userId,
    limit: 1,
  });
  await settleAutoReceivedMallOrders({
    orderId,
    userId: sessionResult.session.userId,
    limit: 1,
  });

  let order = await prisma.mallOrder.findFirst({
    where: {
      id: orderId,
      userId: sessionResult.session.userId,
    },
    include: {
      items: true,
    },
  });

  if (!order) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "订单不存在",
      },
    };
  }

  if (order.status === "PENDING" && (await trySyncMallWechatPaymentStatus(order))) {
    order = await prisma.mallOrder.findUnique({
      where: {
        id: order.id,
      },
      include: {
        items: true,
      },
    });
  }
  const shareUserMap = await buildMallShareUserSummaryMap([order]);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildMallOrderPayload(order, { shareUserMap }),
    },
  };
}

async function listMallCommissionOrders(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  await settleMallRefundStatuses({
    shareSharerUserId: sessionResult.session.userId,
    limit: 50,
  });
  await settleAutoReceivedMallOrders({
    shareSharerUserId: sessionResult.session.userId,
    limit: 50,
  });

  const orders = await prisma.mallOrder.findMany({
    where: {
      shareSharerUserId: sessionResult.session.userId,
      shareCommissionAmount: {
        gt: 0,
      },
      OR: [
        {
          status: "PAID",
        },
        {
          refundStatus: {
            not: "NONE",
          },
        },
      ],
    },
    include: {
      items: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        items: orders.map((order) => buildMallCommissionOrderPayload(order)),
      },
    },
  };
}

function buildMallConfirmReceiptErrorMessage(order) {
  if (!order) {
    return "订单不存在";
  }

  if (order.status === "CLOSED") {
    return "订单已关闭，不能确认收货";
  }

  if (order.status !== "PAID") {
    return "订单支付完成后才能确认收货";
  }

  const refundStatus = normalizeMallRefundStatus(order.refundStatus);
  if (refundStatus === "PENDING" || refundStatus === "PROCESSING" || refundStatus === "SUCCESS") {
    return "订单退款处理中或已退款，不能确认收货";
  }

  const shippingStatus = normalizeMallShippingStatus(order.shippingStatus);
  if (shippingStatus === "PENDING") {
    return "商家发货后才能确认收货";
  }

  if (shippingStatus === "RECEIVED") {
    return "订单已确认收货";
  }

  return "当前订单暂时不能确认收货";
}

async function confirmMallOrderReceipt(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const orderId = normalizeString(input.orderId);
  if (!orderId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少订单ID",
      },
    };
  }

  await settleExpiredMallOrders({
    orderId,
    userId: sessionResult.session.userId,
    limit: 1,
  });
  await settleMallRefundStatuses({
    orderId,
    userId: sessionResult.session.userId,
    limit: 1,
  });
  await settleAutoReceivedMallOrders({
    orderId,
    userId: sessionResult.session.userId,
    limit: 1,
  });

  const order = await prisma.mallOrder.findFirst({
    where: {
      id: orderId,
      userId: sessionResult.session.userId,
    },
    include: {
      items: true,
    },
  });

  if (!order) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "订单不存在",
      },
    };
  }

  if (normalizeMallShippingStatus(order.shippingStatus) === "RECEIVED") {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          item: buildMallOrderPayload(order),
          idempotent: true,
        },
      },
    };
  }

  if (!canMallOrderConfirmReceipt(order)) {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: buildMallConfirmReceiptErrorMessage(order),
      },
    };
  }

  const receiptResult = await receiveMallOrderById(order.id, {
    order,
  });

  if (!receiptResult.order) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "订单不存在",
      },
    };
  }

  if (!receiptResult.updated && !receiptResult.idempotent) {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: buildMallConfirmReceiptErrorMessage(receiptResult.order),
      },
    };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        item: buildMallOrderPayload(receiptResult.order),
        idempotent: receiptResult.idempotent,
      },
    },
  };
}

async function requestMallOrderRefund(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const orderId = normalizeString(input.orderId);
  const reason = normalizeString(input.reason) || "用户申请退款";

  if (!orderId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少订单ID",
      },
    };
  }

  await settleMallRefundStatuses({
    orderId,
    userId: sessionResult.session.userId,
    limit: 1,
  });

  const order = await prisma.mallOrder.findFirst({
    where: {
      id: orderId,
      userId: sessionResult.session.userId,
    },
    include: {
      items: true,
    },
  });

  if (!order) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "订单不存在",
      },
    };
  }

  const refundStatus = normalizeMallRefundStatus(order.refundStatus);
  if (refundStatus === "PENDING" || refundStatus === "PROCESSING" || refundStatus === "SUCCESS") {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          item: buildMallOrderPayload(order),
          idempotent: true,
        },
      },
    };
  }

  if (refundStatus === "REJECTED") {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: "退款申请已被驳回，如需协商请联系商家",
      },
    };
  }

  if (refundStatus === "FAILED") {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: "退款处理失败，请联系商家处理",
      },
    };
  }

  if (order.status !== "PAID") {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: order.status === "CLOSED" ? "订单已关闭，不能再申请退款" : "订单支付完成后才能申请退款",
      },
    };
  }

  if (normalizeMallShippingStatus(order.shippingStatus) === "SHIPPED") {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: "订单已发货，当前最小版本暂不支持在线退款",
      },
    };
  }

  const updatedOrder = await prisma.mallOrder.update({
    where: {
      id: order.id,
    },
    data: {
      refundStatus: "PENDING",
      refundReason: reason,
      refundReviewRemark: "",
      refundRequestedAt: new Date(),
      refundReviewedAt: null,
      refundReviewerUserId: null,
      refundAmount: toMoneyNumber(order.payableAmount).toFixed(2),
      refundOutRefundNo: buildMallRefundOutRefundNo(order),
      refundWechatRefundId: "",
      refundWechatStatus: "",
      refundUserReceivedAccount: "",
      refundedAt: null,
    },
    include: {
      items: true,
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        item: buildMallOrderPayload(updatedOrder),
        idempotent: false,
      },
    },
  };
}

async function reviewAdminMallOrderRefund(input = {}) {
  const sessionResult = await requireMallSession(input.sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const storeId = resolveMallStoreId(input);
  const orderId = normalizeString(input.orderId);
  const action = normalizeString(input.action).toUpperCase();
  const reviewRemark = normalizeString(input.reviewRemark);

  if (!storeId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商城数据源",
      },
    };
  }

  if (!orderId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少订单ID",
      },
    };
  }

  if (action !== "APPROVE" && action !== "REJECT") {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "不支持的退款审批动作",
      },
    };
  }

  await settleMallRefundStatuses({
    orderId,
    storeId,
    limit: 1,
  });

  const existingOrder = await prisma.mallOrder.findFirst({
    where: {
      id: orderId,
      groupId: storeId,
    },
    include: {
      items: true,
      user: {
        include: {
          profile: true,
        },
      },
    },
  });

  if (!existingOrder) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "订单不存在",
      },
    };
  }

  const refundStatus = normalizeMallRefundStatus(existingOrder.refundStatus);
  if (action === "APPROVE" && (refundStatus === "PROCESSING" || refundStatus === "SUCCESS")) {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          item: buildMallOrderPayload(existingOrder, { includeUser: true }),
          idempotent: true,
        },
      },
    };
  }

  if (refundStatus !== "PENDING") {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: "当前订单没有待处理的退款申请",
      },
    };
  }

  if (existingOrder.status !== "PAID") {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: "只有已支付且未发货的订单才能处理退款",
      },
    };
  }

  if (normalizeMallShippingStatus(existingOrder.shippingStatus) === "SHIPPED") {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: "订单已发货，当前最小版本暂不支持在线退款",
      },
    };
  }

  if (action === "REJECT") {
    const updatedOrder = await prisma.mallOrder.update({
      where: {
        id: existingOrder.id,
      },
      data: {
        refundStatus: "REJECTED",
        refundReviewedAt: new Date(),
        refundReviewerUserId: sessionResult.session.userId,
        refundReviewRemark: reviewRemark,
      },
      include: {
        items: true,
        user: {
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
        data: {
          item: buildMallOrderPayload(updatedOrder, { includeUser: true }),
          idempotent: false,
        },
      },
    };
  }

  const refundAmountInFen = Math.round(
    toMoneyNumber(existingOrder.refundAmount || existingOrder.payableAmount || existingOrder.totalAmount) * 100
  );
  const totalAmountInFen = Math.round(toMoneyNumber(existingOrder.payableAmount || existingOrder.totalAmount) * 100);
  const outRefundNo = normalizeString(existingOrder.refundOutRefundNo) || buildMallRefundOutRefundNo(existingOrder);
  const refundResult = await requestDomesticRefund({
    orderNo: existingOrder.orderNo,
    outRefundNo,
    refundAmountInFen,
    totalAmountInFen,
    reason: reviewRemark || existingOrder.refundReason || "商城订单退款",
  });
  const nextRefundStatus = mapWechatRefundStatusToMallRefundStatus(refundResult.status);
  const nextWechatStatus = normalizeString(refundResult.status).toUpperCase();
  const reviewedAt = new Date();
  const shouldCloseOrder = nextRefundStatus === "PROCESSING" || nextRefundStatus === "SUCCESS";

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const currentOrder = await tx.mallOrder.findFirst({
      where: {
        id: existingOrder.id,
        groupId: storeId,
      },
      include: {
        items: true,
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!currentOrder) {
      throw new Error("订单不存在");
    }

    if (normalizeMallRefundStatus(currentOrder.refundStatus) !== "PENDING") {
      return currentOrder;
    }

    if (shouldCloseOrder) {
      for (const item of currentOrder.items) {
        if (!item.productId) {
          continue;
        }

        await tx.mallProduct.updateMany({
          where: {
            id: item.productId,
          },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }
    }

    return tx.mallOrder.update({
      where: {
        id: currentOrder.id,
      },
      data: {
        status: shouldCloseOrder ? "CLOSED" : currentOrder.status,
        refundStatus: nextRefundStatus,
        refundReviewRemark: reviewRemark,
        refundReviewedAt: reviewedAt,
        refundReviewerUserId: sessionResult.session.userId,
        refundAmount: toMoneyNumber(currentOrder.refundAmount || currentOrder.payableAmount).toFixed(2),
        refundOutRefundNo: outRefundNo,
        refundWechatRefundId: normalizeString(refundResult.refundId),
        refundWechatStatus: nextWechatStatus,
        refundUserReceivedAccount: normalizeString(refundResult.userReceivedAccount),
        refundedAt: nextRefundStatus === "SUCCESS" ? currentOrder.refundedAt || reviewedAt : currentOrder.refundedAt,
        ...(shouldCloseOrder ? buildMallShareCommissionUpdate(currentOrder, "CLOSED") : {}),
      },
      include: {
        items: true,
        user: {
          include: {
            profile: true,
          },
        },
      },
    });
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        item: buildMallOrderPayload(updatedOrder, { includeUser: true }),
        idempotent: false,
      },
    },
  };
}

async function listAdminMallCategories(input = {}) {
  const storeId = resolveMallStoreId(input);
  if (!storeId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商城数据源",
      },
    };
  }

  const [categories, productCountMap] = await Promise.all([
    prisma.mallCategory.findMany({
      where: {
        groupId: storeId,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    getCategoryProductCountMap(storeId, true),
  ]);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        items: categories.map((category) => buildCategoryPayload(category, productCountMap)),
      },
    },
  };
}

async function createAdminMallCategory(input = {}) {
  const storeId = resolveMallStoreId(input);
  const name = normalizeString(input.name);
  const sortOrder = normalizeInteger(input.sortOrder, { defaultValue: 0, min: 0, max: 9999 });

  if (!storeId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商城数据源",
      },
    };
  }

  if (!name) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "请输入分类名称",
      },
    };
  }

  const existedCategory = await prisma.mallCategory.findFirst({
    where: {
      groupId: storeId,
      name,
    },
    select: {
      id: true,
    },
  });

  if (existedCategory) {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: "分类名称已存在",
      },
    };
  }

  const category = await prisma.mallCategory.create({
    data: {
      groupId: storeId,
      name,
      sortOrder,
      isEnabled: true,
    },
  });

  return {
    statusCode: 201,
    payload: {
      ok: true,
      data: {
        id: category.id,
      },
    },
  };
}

async function updateAdminMallCategory(input = {}) {
  const storeId = resolveMallStoreId(input);
  const categoryId = normalizeString(input.categoryId);
  const name = normalizeString(input.name);
  const sortOrder = normalizeInteger(input.sortOrder, { defaultValue: 0, min: 0, max: 9999 });
  const isEnabled = normalizeBoolean(input.isEnabled, true);

  if (!storeId || !categoryId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少分类信息",
      },
    };
  }

  if (!name) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "请输入分类名称",
      },
    };
  }

  const category = await prisma.mallCategory.findUnique({
    where: { id: categoryId },
  });

  if (!category || category.groupId !== storeId) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "分类不存在",
      },
    };
  }

  const existedCategory = await prisma.mallCategory.findFirst({
    where: {
      groupId: storeId,
      name,
      id: {
        not: categoryId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existedCategory) {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: "分类名称已存在",
      },
    };
  }

  await prisma.mallCategory.update({
    where: { id: categoryId },
    data: {
      name,
      sortOrder,
      isEnabled,
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      message: "分类已更新",
    },
  };
}

async function listAdminMallProducts(input = {}) {
  const storeId = resolveMallStoreId(input);
  if (!storeId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商城数据源",
      },
    };
  }

  const [categories, products] = await Promise.all([
    prisma.mallCategory.findMany({
      where: {
        groupId: storeId,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.mallProduct.findMany({
      where: {
        groupId: storeId,
      },
      include: {
        category: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        categories: categories.map((category) => ({
          id: category.id,
          name: category.name,
          isEnabled: category.isEnabled,
        })),
        items: products.map((product) => buildProductPayload(product)),
      },
    },
  };
}

async function validateAdminMallProductInput(input = {}, currentProduct) {
  const storeId = resolveMallStoreId(input);
  const categoryId = normalizeString(input.categoryId);
  const title = normalizeString(input.title);
  const subtitle = normalizeString(input.subtitle);
  const coverImageUrl = normalizeString(input.coverImageUrl);
  const price = normalizeMoneyNumber(input.price, { defaultValue: Number.NaN, min: 0.01 });
  const originalPrice = normalizeMoneyNumber(input.originalPrice, { defaultValue: 0, min: 0 });
  const stock = normalizeInteger(input.stock, { defaultValue: 0, min: 0, max: 999999 });
  const isOnSale = normalizeBoolean(input.isOnSale, true);
  const sortOrder = normalizeInteger(input.sortOrder, { defaultValue: 0, min: 0, max: 9999 });

  if (!storeId) {
    return { message: "缺少商城数据源" };
  }

  if (!categoryId) {
    return { message: "请选择商品分类" };
  }

  if (!title) {
    return { message: "请输入商品标题" };
  }

  if (!Number.isFinite(price) || price <= 0) {
    return { message: "请输入正确的商品售价" };
  }

  if (originalPrice > 0 && originalPrice < price) {
    return { message: "原价不能低于售价" };
  }

  const category = await prisma.mallCategory.findUnique({
    where: { id: categoryId },
  });

  if (!category || category.groupId !== storeId) {
    return { message: "商品分类不存在" };
  }

  if (!category.isEnabled) {
    return { message: "当前分类已停用，请先启用分类" };
  }

  if (currentProduct && currentProduct.groupId !== storeId) {
    return { message: "商品不存在" };
  }

  return {
    data: {
      groupId: storeId,
      categoryId,
      title,
      subtitle: subtitle || null,
      coverImageUrl: coverImageUrl || null,
      price: price.toFixed(2),
      originalPrice: (originalPrice > 0 ? originalPrice : price).toFixed(2),
      stock,
      isOnSale,
      sortOrder,
    },
  };
}

async function createAdminMallProduct(input = {}) {
  const validation = await validateAdminMallProductInput(input);
  if (validation.message) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: validation.message,
      },
    };
  }

  const product = await prisma.mallProduct.create({
    data: validation.data,
  });

  return {
    statusCode: 201,
    payload: {
      ok: true,
      data: {
        id: product.id,
      },
    },
  };
}

async function updateAdminMallProduct(input = {}) {
  const storeId = resolveMallStoreId(input);
  const productId = normalizeString(input.productId);
  if (!storeId || !productId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商品信息",
      },
    };
  }

  const currentProduct = await prisma.mallProduct.findUnique({
    where: {
      id: productId,
    },
  });

  if (!currentProduct || currentProduct.groupId !== storeId) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "商品不存在",
      },
    };
  }

  const validation = await validateAdminMallProductInput(input, currentProduct);
  if (validation.message) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: validation.message,
      },
    };
  }

  await prisma.mallProduct.update({
    where: { id: productId },
    data: validation.data,
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      message: "商品已更新",
    },
  };
}

function normalizeAdminMallProductDetailImageItems(inputItems) {
  if (!Array.isArray(inputItems)) {
    return [];
  }

  return inputItems
    .map((item, index) => {
      const imageUrl = normalizeString(item && item.imageUrl);
      if (!imageUrl) {
        return null;
      }

      return {
        mediaType: normalizeMallProductDetailImageMediaType(item && item.mediaType),
        imageUrl,
        title: normalizeString(item && item.title) || null,
        description: normalizeString(item && item.description) || null,
        sortOrder: normalizeInteger(item && item.sortOrder, { defaultValue: index, min: 0, max: 9999 }),
        isEnabled: normalizeBoolean(item && item.isEnabled, true),
      };
    })
    .filter(Boolean);
}

async function listAdminMallProductDetailImages(input = {}) {
  const storeId = resolveMallStoreId(input);
  const productId = normalizeString(input.productId);

  if (!storeId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商城数据源",
      },
    };
  }

  if (!productId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商品ID",
      },
    };
  }

  const product = await prisma.mallProduct.findFirst({
    where: {
      id: productId,
      groupId: storeId,
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (!product) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "商品不存在",
      },
    };
  }

  const detailImages = await prisma.mallProductDetailImage.findMany({
    where: {
      groupId: storeId,
      productId,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        productId: product.id,
        productTitle: product.title,
        items: detailImages.map(buildProductDetailImagePayload),
      },
    },
  };
}

async function updateAdminMallProductDetailImages(input = {}) {
  const storeId = resolveMallStoreId(input);
  const productId = normalizeString(input.productId);
  const inputItems = Array.isArray(input.items) ? input.items : [];

  if (!storeId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商城数据源",
      },
    };
  }

  if (!productId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商品ID",
      },
    };
  }

  const product = await prisma.mallProduct.findFirst({
    where: {
      id: productId,
      groupId: storeId,
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (!product) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "商品不存在",
      },
    };
  }

  const detailImages = normalizeAdminMallProductDetailImageItems(inputItems);
  const carouselImageCount = detailImages.filter(
    (item) => item.mediaType === MALL_PRODUCT_DETAIL_IMAGE_TYPE_CAROUSEL,
  ).length;
  const promotionImageCount = detailImages.filter(
    (item) => item.mediaType === MALL_PRODUCT_DETAIL_IMAGE_TYPE_PROMOTION,
  ).length;

  if (carouselImageCount > MAX_MALL_PRODUCT_CAROUSEL_IMAGES) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: `商品顶部轮播图最多上传 ${MAX_MALL_PRODUCT_CAROUSEL_IMAGES} 张图片`,
      },
    };
  }

  if (promotionImageCount > MAX_MALL_PRODUCT_PROMOTION_IMAGES) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: `商品宣传图最多上传 ${MAX_MALL_PRODUCT_PROMOTION_IMAGES} 张图片`,
      },
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.mallProductDetailImage.deleteMany({
      where: {
        groupId: storeId,
        productId,
      },
    });

    if (!detailImages.length) {
      return;
    }

    await tx.mallProductDetailImage.createMany({
      data: detailImages.map((item) => ({
        groupId: storeId,
        productId,
        mediaType: item.mediaType,
        imageUrl: item.imageUrl,
        title: item.title,
        description: item.description,
        sortOrder: item.sortOrder,
        isEnabled: item.isEnabled,
      })),
    });
  });

  const savedDetailImages = await prisma.mallProductDetailImage.findMany({
    where: {
      groupId: storeId,
      productId,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        productId: product.id,
        productTitle: product.title,
        items: savedDetailImages.map(buildProductDetailImagePayload),
      },
    },
  };
}

async function listAdminMallOrders(input = {}) {
  const storeId = resolveMallStoreId(input);
  const limit = normalizeInteger(input.limit, {
    defaultValue: DEFAULT_ADMIN_ORDER_LIMIT,
    min: 1,
    max: 100,
  });

  if (!storeId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商城数据源",
      },
    };
  }

  await settleExpiredMallOrders({
    storeId,
    limit: 100,
  });
  await settleMallRefundStatuses({
    storeId,
    limit: 100,
  });
  await settleAutoReceivedMallOrders({
    storeId,
    limit: 100,
  });

  const [
    orders,
    orderCount,
    grossResult,
    pendingCount,
    readyToShipCount,
    shippedCount,
    refundPendingCount,
    refundProcessingCount,
    refundedCount,
  ] = await Promise.all([
    prisma.mallOrder.findMany({
      where: {
        groupId: storeId,
      },
      include: {
        items: true,
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: limit,
    }),
    prisma.mallOrder.count({
      where: {
        groupId: storeId,
      },
    }),
    prisma.mallOrder.aggregate({
      where: {
        groupId: storeId,
      },
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.mallOrder.count({
      where: {
        groupId: storeId,
        status: "PENDING",
      },
    }),
    prisma.mallOrder.count({
      where: {
        groupId: storeId,
        status: "PAID",
        shippingStatus: {
          not: "SHIPPED",
        },
        refundStatus: {
          in: ["NONE", "REJECTED", "FAILED"],
        },
      },
    }),
    prisma.mallOrder.count({
      where: {
        groupId: storeId,
        shippingStatus: "SHIPPED",
      },
    }),
    prisma.mallOrder.count({
      where: {
        groupId: storeId,
        refundStatus: "PENDING",
      },
    }),
    prisma.mallOrder.count({
      where: {
        groupId: storeId,
        refundStatus: "PROCESSING",
      },
    }),
    prisma.mallOrder.count({
      where: {
        groupId: storeId,
        refundStatus: "SUCCESS",
      },
    }),
  ]);
  const shareUserMap = await buildMallShareUserSummaryMap(orders);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        summary: {
          orderCount,
          pendingCount,
          readyToShipCount,
          shippedCount,
          refundPendingCount,
          refundProcessingCount,
          refundedCount,
          grossAmount: toMoneyNumber(grossResult._sum.totalAmount),
          grossAmountText: formatMoney(grossResult._sum.totalAmount),
        },
        items: orders.map((order) => buildMallOrderPayload(order, { includeUser: true, shareUserMap })),
      },
    },
  };
}

async function updateAdminMallOrderStatus(input = {}) {
  const storeId = resolveMallStoreId(input);
  const orderId = normalizeString(input.orderId);
  const status = normalizeMallOrderEditableStatus(input.status);

  if (!storeId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商城数据源",
      },
    };
  }

  if (!orderId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少订单ID",
      },
    };
  }

  if (!status) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "订单状态不合法",
      },
    };
  }

  const existingOrder = await prisma.mallOrder.findFirst({
    where: {
      id: orderId,
      groupId: storeId,
    },
    include: {
      items: true,
      user: {
        include: {
          profile: true,
        },
      },
    },
  });

  if (!existingOrder) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "订单不存在",
      },
    };
  }

  if (existingOrder.status === status) {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          item: buildMallOrderPayload(existingOrder, { includeUser: true }),
        },
      },
    };
  }

  if (existingOrder.status !== "PENDING") {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: existingOrder.status === "PAID" ? "已支付订单暂不支持直接改状态" : "已关闭订单不能再次修改状态",
      },
    };
  }

  if (status === "PENDING") {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "订单当前已是待支付状态",
      },
    };
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    if (status === "CLOSED") {
      for (const item of existingOrder.items) {
        if (!item.productId) {
          continue;
        }

        await tx.mallProduct.updateMany({
          where: {
            id: item.productId,
          },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }
    }

    return tx.mallOrder.update({
      where: { id: existingOrder.id },
      data: {
        status,
        ...buildMallShareCommissionUpdate(existingOrder, status),
      },
      include: {
        items: true,
        user: {
          include: {
            profile: true,
          },
        },
      },
    });
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        item: buildMallOrderPayload(updatedOrder, { includeUser: true }),
      },
    },
  };
}

async function shipAdminMallOrder(input = {}) {
  const storeId = resolveMallStoreId(input);
  const orderId = normalizeString(input.orderId);
  const shippingCompany = normalizeString(input.shippingCompany);
  const shippingTrackingNo = normalizeString(input.shippingTrackingNo);
  const shippingRemark = normalizeString(input.shippingRemark);

  if (!storeId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少商城数据源",
      },
    };
  }

  if (!orderId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少订单ID",
      },
    };
  }

  if (!shippingCompany) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "请输入物流公司",
      },
    };
  }

  if (!shippingTrackingNo) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "请输入物流单号",
      },
    };
  }

  const existingOrder = await prisma.mallOrder.findFirst({
    where: {
      id: orderId,
      groupId: storeId,
    },
    include: {
      items: true,
      user: {
        include: {
          profile: true,
        },
      },
    },
  });

  if (!existingOrder) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "订单不存在",
      },
    };
  }

  const refundStatus = normalizeMallRefundStatus(existingOrder.refundStatus);
  if (refundStatus === "PENDING") {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: "订单存在待审核退款申请，请先处理退款",
      },
    };
  }

  if (refundStatus === "PROCESSING" || refundStatus === "SUCCESS") {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: "订单退款处理中或已退款，不能继续发货",
      },
    };
  }

  if (existingOrder.status !== "PAID") {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        message: existingOrder.status === "PENDING" ? "订单尚未确认支付，请先标记已支付" : "已关闭订单不能发货",
      },
    };
  }

  const updatedOrder = await prisma.mallOrder.update({
    where: {
      id: existingOrder.id,
    },
    data: {
      shippingStatus: "SHIPPED",
      shippingCompany,
      shippingTrackingNo,
      shippingRemark,
      shippedAt: existingOrder.shippedAt || new Date(),
    },
    include: {
      items: true,
      user: {
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
      data: {
        item: buildMallOrderPayload(updatedOrder, { includeUser: true }),
      },
    },
  };
}

module.exports = {
  trackMallAnalyticsEvent,
  getMallConfig,
  listMallCoupons,
  listMallCategories,
  listMallProducts,
  getMallProductDetail,
  createMallProductShareToken,
  listMallProductReviews,
  createMallProductReview,
  getMallShippingAddress,
  upsertMallShippingAddress,
  setDefaultMallShippingAddress,
  deleteMallShippingAddress,
  listMallCart,
  addMallCartItem,
  updateMallCartItem,
  deleteMallCartItem,
  clearMallCart,
  createMallOrder,
  prepareMallOrderPayment,
  listMallOrders,
  listMallCommissionOrders,
  getMallOrderDetail,
  confirmMallOrderReceipt,
  requestMallOrderRefund,
  startMallOrderAutoCloseScheduler,
  startMallOrderAutoReceiveScheduler,
  findMallOrderByOrderNo,
  applyMallOrderPaymentSuccess,
  listAdminMallCategories,
  createAdminMallCategory,
  updateAdminMallCategory,
  listAdminMallProducts,
  createAdminMallProduct,
  updateAdminMallProduct,
  listAdminMallProductDetailImages,
  updateAdminMallProductDetailImages,
  listAdminMallOrders,
  getAdminMallMemberZoneConfig,
  getAdminMallCouponAnalytics,
  updateAdminMallMemberZoneConfig,
  updateAdminMallOrderStatus,
  reviewAdminMallOrderRefund,
  shipAdminMallOrder,
  authorizeMallAdminAccess,
  __test__: {
    buildMallOrderPayload,
  },
};
