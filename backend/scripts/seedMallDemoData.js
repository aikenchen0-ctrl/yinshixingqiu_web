const { prisma } = require("../src/db/prisma");
const { ensureDemoData, IDS } = require("../src/db/seedDemoData");

const CATEGORY_SEEDS = [
  { id: "mall_cat_digital_001", key: "digital", name: "数码", slug: "digital", sortOrder: 10 },
  { id: "mall_cat_appliance_001", key: "appliance", name: "家电", slug: "appliance", sortOrder: 20 },
  { id: "mall_cat_home_001", key: "home", name: "家居", slug: "home", sortOrder: 30 },
  { id: "mall_cat_beauty_001", key: "beauty", name: "美妆", slug: "beauty", sortOrder: 40 },
  { id: "mall_cat_food_001", key: "food", name: "食品", slug: "food", sortOrder: 50 },
];

const PRODUCT_SEEDS = [
  {
    id: "mall_prod_iphone15_001",
    categoryKey: "digital",
    title: "Apple iPhone 15 128G",
    subtitle: "商城 MVP 标准高客单商品，用于验证分类、详情、购物车和下单链路。",
    price: 5499,
    originalPrice: 5999,
    stock: 16,
    sortOrder: 10,
  },
  {
    id: "mall_prod_xiaomi_pad_001",
    categoryKey: "digital",
    title: "小米平板 6 8+128G",
    subtitle: "常规数码商品示例，适合前后台联调库存与价格展示。",
    price: 1899,
    originalPrice: 2199,
    stock: 38,
    sortOrder: 20,
  },
  {
    id: "mall_prod_airpods_001",
    categoryKey: "digital",
    title: "无线蓝牙耳机 Pro",
    subtitle: "轻量数码商品，适合测试购物车多件组合下单。",
    price: 499,
    originalPrice: 699,
    stock: 52,
    sortOrder: 30,
  },
  {
    id: "mall_prod_air_fryer_001",
    categoryKey: "appliance",
    title: "家用空气炸锅 5L",
    subtitle: "家电类标准单品，字段简单，便于后台维护。",
    price: 289,
    originalPrice: 399,
    stock: 82,
    sortOrder: 10,
  },
  {
    id: "mall_prod_kettle_001",
    categoryKey: "appliance",
    title: "恒温电热水壶 1.7L",
    subtitle: "基础家电商品，用于验证多分类商品管理。",
    price: 169,
    originalPrice: 229,
    stock: 64,
    sortOrder: 20,
  },
  {
    id: "mall_prod_storage_box_001",
    categoryKey: "home",
    title: "北欧收纳箱四件套",
    subtitle: "家居类标准商品，适合展示低价高库存商品。",
    price: 129,
    originalPrice: 169,
    stock: 120,
    sortOrder: 10,
  },
  {
    id: "mall_prod_bedding_001",
    categoryKey: "home",
    title: "纯棉四件套 1.8m",
    subtitle: "家居爆款示例，利于测试商品编辑和状态切换。",
    price: 259,
    originalPrice: 329,
    stock: 44,
    sortOrder: 20,
  },
  {
    id: "mall_prod_lipstick_001",
    categoryKey: "beauty",
    title: "经典口红礼盒三支装",
    subtitle: "美妆类礼盒商品示例，适合前端列表展示。",
    price: 369,
    originalPrice: 459,
    stock: 45,
    sortOrder: 10,
  },
  {
    id: "mall_prod_mask_001",
    categoryKey: "beauty",
    title: "补水面膜 20 片装",
    subtitle: "标准快消品示例，适合多件加购联调。",
    price: 99,
    originalPrice: 139,
    stock: 88,
    sortOrder: 20,
  },
  {
    id: "mall_prod_coffee_001",
    categoryKey: "food",
    title: "精品咖啡豆 1kg",
    subtitle: "食品类标准商品示例，便于验证分类切换。",
    price: 139,
    originalPrice: 189,
    stock: 96,
    sortOrder: 10,
  },
  {
    id: "mall_prod_nuts_001",
    categoryKey: "food",
    title: "每日坚果礼盒 30 袋",
    subtitle: "食品礼盒商品示例，用于后台订单查看。",
    price: 118,
    originalPrice: 158,
    stock: 73,
    sortOrder: 20,
  },
];

const ORDER_SEEDS = [
  {
    id: "mall_order_seed_001",
    orderNo: "MALL_SEED_20260415_001",
    userId: IDS.buyerUser,
    status: "PENDING",
    remark: "示例订单：待处理",
    createdOffsetMinutes: 6,
    shipping: {
      recipientName: "李测试",
      phone: "13800001111",
      province: "浙江省",
      city: "杭州市",
      district: "西湖区",
      detailAddress: "演示路 8 号 2 栋 302",
    },
    items: [
      { productId: "mall_prod_iphone15_001", quantity: 1 },
      { productId: "mall_prod_mask_001", quantity: 2 },
    ],
  },
  {
    id: "mall_order_seed_002",
    orderNo: "MALL_SEED_20260415_002",
    userId: IDS.ownerUser,
    status: "PAID",
    remark: "示例订单：已支付",
    createdOffsetMinutes: 55,
    shipping: {
      recipientName: "周演示",
      phone: "13800002222",
      province: "上海市",
      city: "上海市",
      district: "浦东新区",
      detailAddress: "张江演示路 18 号",
    },
    items: [
      { productId: "mall_prod_air_fryer_001", quantity: 1 },
      { productId: "mall_prod_coffee_001", quantity: 1 },
    ],
  },
  {
    id: "mall_order_seed_003",
    orderNo: "MALL_SEED_20260415_003",
    userId: IDS.ownerUser,
    status: "PAID",
    remark: "示例订单：已发货",
    createdOffsetMinutes: 190,
    shippingStatus: "SHIPPED",
    shippingCompany: "顺丰速运",
    shippingTrackingNo: "SF00000020260415003",
    shippingRemark: "示例物流：已由仓库打包发出",
    shippedOffsetMinutes: 120,
    shipping: {
      recipientName: "王发货",
      phone: "13800003333",
      province: "江苏省",
      city: "苏州市",
      district: "工业园区",
      detailAddress: "星海街道示例公寓 5 幢 1802",
    },
    items: [
      { productId: "mall_prod_storage_box_001", quantity: 1 },
      { productId: "mall_prod_bedding_001", quantity: 1 },
    ],
  },
  {
    id: "mall_order_seed_004",
    orderNo: "MALL_SEED_20260415_004",
    userId: IDS.buyerUser,
    status: "PAID",
    remark: "示例订单：退款待审核",
    createdOffsetMinutes: 110,
    refundStatus: "PENDING",
    refundReason: "买错了，想重新下单",
    refundRequestedOffsetMinutes: 18,
    shipping: {
      recipientName: "赵退款",
      phone: "13800004444",
      province: "北京市",
      city: "北京市",
      district: "朝阳区",
      detailAddress: "望京示例中心 B 座 1208",
    },
    items: [
      { productId: "mall_prod_xiaomi_pad_001", quantity: 1 },
    ],
  },
  {
    id: "mall_order_seed_005",
    orderNo: "MALL_SEED_20260415_005",
    userId: IDS.ownerUser,
    status: "CLOSED",
    remark: "示例订单：退款处理中",
    createdOffsetMinutes: 240,
    refundStatus: "PROCESSING",
    refundReason: "暂时不想要了",
    refundReviewRemark: "商家已同意退款，等待微信处理结果",
    refundRequestedOffsetMinutes: 65,
    refundReviewedOffsetMinutes: 50,
    refundReviewerUserId: IDS.ownerUser,
    refundWechatStatus: "PROCESSING",
    refundOutRefundNo: "MRMALL_SEED_20260415_005",
    refundWechatRefundId: "50000000020260415005",
    shipping: {
      recipientName: "孙处理中",
      phone: "13800005555",
      province: "广东省",
      city: "深圳市",
      district: "南山区",
      detailAddress: "科苑路示例大厦 21 层",
    },
    items: [
      { productId: "mall_prod_airpods_001", quantity: 1 },
      { productId: "mall_prod_nuts_001", quantity: 1 },
    ],
  },
  {
    id: "mall_order_seed_006",
    orderNo: "MALL_SEED_20260415_006",
    userId: IDS.buyerUser,
    status: "CLOSED",
    remark: "示例订单：已退款",
    createdOffsetMinutes: 360,
    refundStatus: "SUCCESS",
    refundReason: "收货信息填错了",
    refundReviewRemark: "已原路退回",
    refundRequestedOffsetMinutes: 160,
    refundReviewedOffsetMinutes: 145,
    refundedOffsetMinutes: 135,
    refundReviewerUserId: IDS.ownerUser,
    refundWechatStatus: "SUCCESS",
    refundOutRefundNo: "MRMALL_SEED_20260415_006",
    refundWechatRefundId: "50000000020260415006",
    refundUserReceivedAccount: "招商银行储蓄卡(尾号 1024)",
    shipping: {
      recipientName: "钱已退款",
      phone: "13800006666",
      province: "四川省",
      city: "成都市",
      district: "高新区",
      detailAddress: "天府软件园 C 区 3 栋",
    },
    items: [
      { productId: "mall_prod_lipstick_001", quantity: 1 },
      { productId: "mall_prod_mask_001", quantity: 1 },
    ],
  },
];

const REVIEW_SEEDS = [
  {
    productId: "mall_prod_iphone15_001",
    userId: IDS.buyerUser,
    rating: 5,
    content: "到手很稳，系统流畅，第一版商城用它做高客单样本比较合适。",
    isAnonymous: false,
  },
  {
    productId: "mall_prod_air_fryer_001",
    userId: IDS.ownerUser,
    rating: 4,
    content: "容量够用，操作简单，适合拿来跑家电类商品的下单和评价流程。",
    isAnonymous: false,
  },
  {
    productId: "mall_prod_mask_001",
    userId: IDS.ownerUser,
    rating: 5,
    content: "快消品做加购联调很顺手，价格和库存字段都比较好验证。",
    isAnonymous: true,
  },
];

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function resolveOffsetDate(offsetMinutes) {
  const minutes = Number(offsetMinutes);
  if (!Number.isFinite(minutes) || minutes < 0) {
    return null;
  }

  return new Date(Date.now() - minutes * 60 * 1000);
}

async function resolveSeedGroupId() {
  const directGroup = await prisma.group.findUnique({
    where: { id: IDS.group },
    select: { id: true, name: true },
  });

  if (directGroup) {
    return directGroup;
  }

  return prisma.group.findFirst({
    where: {
      status: {
        in: ["ACTIVE", "HIDDEN", "DRAFT"],
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true },
  });
}

async function upsertCategory(groupId, seed) {
  const existingCategory = await prisma.mallCategory.findFirst({
    where: {
      groupId,
      OR: [{ id: seed.id }, { name: seed.name }, { slug: seed.slug }],
    },
  });

  if (existingCategory) {
    return prisma.mallCategory.update({
      where: { id: existingCategory.id },
      data: {
        name: seed.name,
        slug: seed.slug,
        sortOrder: seed.sortOrder,
        isEnabled: true,
      },
    });
  }

  return prisma.mallCategory.create({
    data: {
      id: seed.id,
      groupId,
      name: seed.name,
      slug: seed.slug,
      sortOrder: seed.sortOrder,
      isEnabled: true,
    },
  });
}

async function upsertProduct(groupId, categoryId, seed) {
  const existingProduct = await prisma.mallProduct.findFirst({
    where: {
      groupId,
      OR: [{ id: seed.id }, { categoryId, title: seed.title }],
    },
  });

  const data = {
    groupId,
    categoryId,
    title: seed.title,
    subtitle: seed.subtitle,
    coverImageUrl: null,
    price: formatMoney(seed.price),
    originalPrice: formatMoney(seed.originalPrice),
    stock: seed.stock,
    isOnSale: true,
    sortOrder: seed.sortOrder,
  };

  if (existingProduct) {
    return prisma.mallProduct.update({
      where: { id: existingProduct.id },
      data,
    });
  }

  return prisma.mallProduct.create({
    data: {
      id: seed.id,
      ...data,
    },
  });
}

async function upsertOrder(groupId, productMap, seed) {
  const items = seed.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error(`缺少示例订单商品: ${item.productId}`);
    }

    const unitPrice = Number(product.price);
    const totalAmount = unitPrice * item.quantity;

    return {
      productId: product.id,
      productTitle: product.title,
      productSubtitle: product.subtitle || null,
      coverImageUrl: product.coverImageUrl || null,
      unitPrice: formatMoney(unitPrice),
      quantity: item.quantity,
      totalAmount: formatMoney(totalAmount),
    };
  });

  const totalAmount = items.reduce((sum, item) => sum + Number(item.totalAmount), 0);
  const createdAt = resolveOffsetDate(seed.createdOffsetMinutes) || new Date();
  const shippedAt = resolveOffsetDate(seed.shippedOffsetMinutes);
  const refundRequestedAt = resolveOffsetDate(seed.refundRequestedOffsetMinutes);
  const refundReviewedAt = resolveOffsetDate(seed.refundReviewedOffsetMinutes);
  const refundedAt = resolveOffsetDate(seed.refundedOffsetMinutes);
  const shipping = seed.shipping || {};
  const refundStatus = String(seed.refundStatus || "NONE").trim().toUpperCase() || "NONE";
  const refundAmount =
    refundStatus === "NONE" ? null : formatMoney(typeof seed.refundAmount === "number" ? seed.refundAmount : totalAmount);
  const orderData = {
    groupId,
    userId: seed.userId,
    status: seed.status,
    totalAmount: formatMoney(totalAmount),
    payableAmount: formatMoney(totalAmount),
    remark: seed.remark,
    shippingRecipientName: shipping.recipientName || "",
    shippingRecipientPhone: shipping.phone || "",
    shippingProvince: shipping.province || "",
    shippingCity: shipping.city || "",
    shippingDistrict: shipping.district || "",
    shippingDetailAddress: shipping.detailAddress || "",
    shippingStatus: seed.shippingStatus || "PENDING",
    shippingCompany: seed.shippingCompany || "",
    shippingTrackingNo: seed.shippingTrackingNo || "",
    shippingRemark: seed.shippingRemark || "",
    shippedAt,
    refundStatus,
    refundReason: seed.refundReason || null,
    refundReviewRemark: seed.refundReviewRemark || null,
    refundRequestedAt,
    refundReviewedAt,
    refundReviewerUserId: seed.refundReviewerUserId || null,
    refundAmount,
    refundOutRefundNo: seed.refundOutRefundNo || null,
    refundWechatRefundId: seed.refundWechatRefundId || null,
    refundWechatStatus: seed.refundWechatStatus || null,
    refundUserReceivedAccount: seed.refundUserReceivedAccount || null,
    refundedAt,
  };
  const existingOrder = await prisma.mallOrder.findFirst({
    where: {
      OR: [{ id: seed.id }, { orderNo: seed.orderNo }],
    },
  });

  if (existingOrder) {
    await prisma.mallOrderItem.deleteMany({
      where: {
        orderId: existingOrder.id,
      },
    });

    return prisma.mallOrder.update({
      where: { id: existingOrder.id },
      data: {
        ...orderData,
        createdAt,
        items: {
          create: items,
        },
      },
      include: {
        items: true,
      },
    });
  }

  return prisma.mallOrder.create({
    data: {
      id: seed.id,
      orderNo: seed.orderNo,
      ...orderData,
      createdAt,
      items: {
        create: items,
      },
    },
    include: {
      items: true,
    },
  });
}

async function upsertReview(productMap, seed) {
  const product = productMap.get(seed.productId);
  if (!product) {
    throw new Error(`缺少示例评价商品: ${seed.productId}`);
  }

  return prisma.mallProductReview.upsert({
    where: {
      userId_productId: {
        userId: seed.userId,
        productId: product.id,
      },
    },
    update: {
      rating: seed.rating,
      content: seed.content,
      isAnonymous: Boolean(seed.isAnonymous),
    },
    create: {
      productId: product.id,
      userId: seed.userId,
      rating: seed.rating,
      content: seed.content,
      isAnonymous: Boolean(seed.isAnonymous),
    },
  });
}

async function main() {
  await ensureDemoData();

  const group = await resolveSeedGroupId();
  if (!group) {
    throw new Error("找不到可用的星球，无法灌入商城初始化数据");
  }

  const categoryMap = new Map();
  for (const seed of CATEGORY_SEEDS) {
    const category = await upsertCategory(group.id, seed);
    categoryMap.set(seed.key, category);
  }

  const productMap = new Map();
  for (const seed of PRODUCT_SEEDS) {
    const category = categoryMap.get(seed.categoryKey);
    if (!category) {
      throw new Error(`缺少商品分类: ${seed.categoryKey}`);
    }

    const product = await upsertProduct(group.id, category.id, seed);
    productMap.set(seed.id, product);
  }

  const orders = [];
  for (const seed of ORDER_SEEDS) {
    const order = await upsertOrder(group.id, productMap, seed);
    orders.push({
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      totalAmount: formatMoney(order.totalAmount),
    });
  }

  for (const seed of REVIEW_SEEDS) {
    await upsertReview(productMap, seed);
  }

  const summary = {
    ok: true,
    groupId: group.id,
    groupName: group.name,
    categoryCount: CATEGORY_SEEDS.length,
    productCount: PRODUCT_SEEDS.length,
    orderCount: ORDER_SEEDS.length,
    reviewCount: REVIEW_SEEDS.length,
    orders,
  };

  console.log(JSON.stringify(summary, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
