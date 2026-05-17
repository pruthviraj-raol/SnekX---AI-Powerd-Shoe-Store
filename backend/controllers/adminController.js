const User = require("../models/User");
const Order = require("../models/Order");
const AIEvent = require("../models/AIEvent");
const SearchLog = require("../models/SearchLog");
const ChatQuery = require("../models/ChatQuery");
const ContactQuery = require("../models/ContactQuery");
const asyncHandler = require("../middleware/asyncHandler");

const CONTACT_QUERY_STATUSES = new Set(["pending", "in_progress", "replied", "resolved", "closed"]);

const DAY_MS = 24 * 60 * 60 * 1000;
const RECOMMENDATION_CATEGORY_PIPELINE = [
  {
    $project: {
      productId: 1,
      productSnapshot: 1,
      timestamp: 1,
      normalizedCategory: {
        $toLower: {
          $trim: {
            input: {
              $convert: {
                input: {
                  $let: {
                    vars: {
                      rawCategory: {
                        $ifNull: ["$productSnapshot.category", "$category"],
                      },
                    },
                    in: {
                      $cond: [
                        { $isArray: "$$rawCategory" },
                        { $ifNull: [{ $first: "$$rawCategory" }, ""] },
                        "$$rawCategory",
                      ],
                    },
                  },
                },
                to: "string",
                onError: "",
                onNull: "",
              },
            },
          },
        },
      },
    },
  },
  {
    $project: {
      productId: 1,
      productSnapshot: 1,
      timestamp: 1,
      category: {
        $cond: [{ $eq: ["$normalizedCategory", ""] }, "uncategorized", "$normalizedCategory"],
      },
    },
  },
];

const getPercentageChange = (current, previous) => {
  if (!previous) {
    return current > 0 ? 100 : 0;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const buildMetricTrend = (current, previous) => {
  const change = getPercentageChange(current, previous);

  return {
    change,
    direction: change >= 0 ? "up" : "down",
  };
};

const formatIsoDate = (date) => date.toISOString().slice(0, 10);

const fillDailySeries = (startDate, days, rawSeries, valueKey) => {
  const valuesByDate = new Map(rawSeries.map((item) => [item.date, item[valueKey]]));

  return Array.from({ length: days }, (_, index) => {
    const pointDate = new Date(startDate);
    pointDate.setUTCDate(startDate.getUTCDate() + index);

    const date = formatIsoDate(pointDate);

    return {
      date,
      [valueKey]: valuesByDate.get(date) || 0,
    };
  });
};

const fillMonthlySeries = (startDate, months, rawSeries, valueKey) => {
  const valuesByMonth = new Map(rawSeries.map((item) => [item.month, item[valueKey]]));

  return Array.from({ length: months }, (_, index) => {
    const pointDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + index, 1));
    const month = formatIsoDate(pointDate).slice(0, 7);

    return {
      month,
      [valueKey]: valuesByMonth.get(month) || 0,
    };
  });
};

const buildTrimmedStringExpression = (valueExpression = "") => ({
  $let: {
    vars: {
      rawValue: {
        $ifNull: [valueExpression, ""],
      },
    },
    in: {
      $trim: {
        input: {
          $convert: {
            input: {
              $cond: [
                { $isArray: "$$rawValue" },
                { $ifNull: [{ $first: "$$rawValue" }, ""] },
                "$$rawValue",
              ],
            },
            to: "string",
            onError: "",
            onNull: "",
          },
        },
      },
    },
  },
});

const buildNormalizedCategoryExpression = (valueExpression = "") => ({
  $toLower: buildTrimmedStringExpression(valueExpression),
});

const buildFirstNonEmptyStringExpression = (candidates = [], fallback = "") => {
  if (!candidates.length) {
    return fallback;
  }

  const [candidate, ...rest] = candidates;

  return {
    $let: {
      vars: {
        candidateValue: candidate,
      },
      in: {
        $cond: [
          { $ne: ["$$candidateValue", ""] },
          "$$candidateValue",
          buildFirstNonEmptyStringExpression(rest, fallback),
        ],
      },
    },
  };
};

const getDashboard = asyncHandler(async (_req, res) => {
  const now = new Date();
  const currentPeriodStart = new Date(now);
  currentPeriodStart.setUTCHours(0, 0, 0, 0);
  currentPeriodStart.setUTCDate(currentPeriodStart.getUTCDate() - 29);

  const previousPeriodStart = new Date(currentPeriodStart);
  previousPeriodStart.setUTCDate(previousPeriodStart.getUTCDate() - 30);

  const dailyTrendStart = new Date(now);
  dailyTrendStart.setUTCHours(0, 0, 0, 0);
  dailyTrendStart.setUTCDate(dailyTrendStart.getUTCDate() - 13);

  const revenueTrendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [
    revenueResult,
    totalOrders,
    totalUsers,
    recentOrders,
    topProducts,
    totalAIRecommendationsResult,
    currentRevenueResult,
    previousRevenueResult,
    currentOrders,
    previousOrders,
    currentUsers,
    previousUsers,
    currentRecommendations,
    previousRecommendations,
    currentPurchases,
    previousPurchases,
    revenueTrendRaw,
    ordersTrendRaw,
    searchTrendRaw,
    recentSearches,
    recentAIEvents,
    topSearchTerms,
    popularCategoryResult,
    highestConversionProductResult,
  ] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          orderStatus: { $ne: "Cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
    ]),
    Order.countDocuments(),
    User.countDocuments(),
    Order.find({})
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("userId", "name email"),
    Order.aggregate([
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.productId",
          productName: { $first: "$products.name" },
          sales: { $sum: "$products.quantity" },
          revenue: { $sum: { $multiply: ["$products.quantity", "$products.price"] } },
          orderIds: { $addToSet: "$_id" },
        },
      },
      {
        $addFields: {
          orderCount: { $size: "$orderIds" },
        },
      },
      {
        $project: {
          orderIds: 0,
        },
      },
      { $sort: { sales: -1 } },
      { $limit: 5 },
    ]),
    AIEvent.aggregate([
      { $match: { eventType: "recommendation" } },
      { $count: "count" },
    ]),
    Order.aggregate([
      {
        $match: {
          orderStatus: { $ne: "Cancelled" },
          createdAt: { $gte: currentPeriodStart },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          orderStatus: { $ne: "Cancelled" },
          createdAt: { $gte: previousPeriodStart, $lt: currentPeriodStart },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
    ]),
    Order.countDocuments({ createdAt: { $gte: currentPeriodStart } }),
    Order.countDocuments({ createdAt: { $gte: previousPeriodStart, $lt: currentPeriodStart } }),
    User.countDocuments({ createdAt: { $gte: currentPeriodStart } }),
    User.countDocuments({ createdAt: { $gte: previousPeriodStart, $lt: currentPeriodStart } }),
    AIEvent.countDocuments({ eventType: "recommendation", timestamp: { $gte: currentPeriodStart } }),
    AIEvent.countDocuments({ eventType: "recommendation", timestamp: { $gte: previousPeriodStart, $lt: currentPeriodStart } }),
    AIEvent.countDocuments({ eventType: "purchase", timestamp: { $gte: currentPeriodStart } }),
    AIEvent.countDocuments({ eventType: "purchase", timestamp: { $gte: previousPeriodStart, $lt: currentPeriodStart } }),
    Order.aggregate([
      {
        $match: {
          orderStatus: { $ne: "Cancelled" },
          createdAt: { $gte: revenueTrendStart },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$createdAt",
            },
          },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          month: "$_id",
          revenue: 1,
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: dailyTrendStart },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: 1,
        },
      },
    ]),
    SearchLog.aggregate([
      {
        $match: {
          createdAt: { $gte: dailyTrendStart },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: 1,
        },
      },
    ]),
    SearchLog.find({})
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("userId", "name email"),
    AIEvent.aggregate([
      { $match: { eventType: "recommendation" } },
      { $sort: { timestamp: -1 } },
      { $limit: 6 },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: {
          path: "$product",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          category: 1,
          timestamp: 1,
          productName: "$product.name",
          brand: "$product.brand",
        },
      },
    ]),
    SearchLog.aggregate([
      {
        $group: {
          _id: "$term",
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          _id: { $ne: "" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          term: "$_id",
          count: 1,
        },
      },
    ]),
    AIEvent.aggregate([
      { $match: { eventType: "recommendation", category: { $ne: "" } } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 1 },
      {
        $project: {
          _id: 0,
          category: "$_id",
          count: 1,
        },
      },
    ]),
    AIEvent.aggregate([
      {
        $match: {
          eventType: { $in: ["recommendation", "purchase"] },
        },
      },
      {
        $group: {
          _id: "$productId",
          recommendations: {
            $sum: {
              $cond: [{ $eq: ["$eventType", "recommendation"] }, 1, 0],
            },
          },
          purchases: {
            $sum: {
              $cond: [{ $eq: ["$eventType", "purchase"] }, 1, 0],
            },
          },
        },
      },
      {
        $match: {
          recommendations: { $gt: 0 },
        },
      },
      {
        $addFields: {
          conversionRate: {
            $multiply: [{ $divide: ["$purchases", "$recommendations"] }, 100],
          },
        },
      },
      { $sort: { conversionRate: -1, purchases: -1, recommendations: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: {
          path: "$product",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          productId: { $toString: "$_id" },
          name: "$product.name",
          brand: "$product.brand",
          recommendations: 1,
          purchases: 1,
          conversionRate: 1,
        },
      },
    ]),
  ]);

  const totalRevenue = revenueResult[0]?.totalRevenue || 0;
  const totalAIRecommendationsServed = totalAIRecommendationsResult[0]?.count || 0;
  const currentRevenue = currentRevenueResult[0]?.totalRevenue || 0;
  const previousRevenue = previousRevenueResult[0]?.totalRevenue || 0;
  const currentConversionRate = currentRecommendations
    ? Number(((currentPurchases / currentRecommendations) * 100).toFixed(2))
    : 0;
  const previousConversionRate = previousRecommendations
    ? Number(((previousPurchases / previousRecommendations) * 100).toFixed(2))
    : 0;
  const aiConversionRate = totalAIRecommendationsServed
    ? Number(((await AIEvent.countDocuments({ eventType: "purchase" })) / totalAIRecommendationsServed * 100).toFixed(2))
    : 0;
  const revenueTrend = fillMonthlySeries(revenueTrendStart, 6, revenueTrendRaw, "revenue");
  const ordersTrend = fillDailySeries(dailyTrendStart, 14, ordersTrendRaw, "count");
  const searchTrend = fillDailySeries(dailyTrendStart, 14, searchTrendRaw, "count");
  const topSearchTerm = topSearchTerms[0] || null;
  const mostPopularCategory = popularCategoryResult[0] || null;
  const highestConversionProduct = highestConversionProductResult[0]
    ? {
        ...highestConversionProductResult[0],
        conversionRate: Number((highestConversionProductResult[0].conversionRate || 0).toFixed(2)),
      }
    : null;
  const activityFeed = [
    ...recentSearches.map((search) => ({
      id: `search-${search._id}`,
      type: "search",
      title: `User searched ${search.term}`,
      description: search.userId?.name
        ? `${search.userId.name} searched for "${search.term}".`
        : `A shopper searched for "${search.term}".`,
      timestamp: search.createdAt,
    })),
    ...recentOrders.map((order) => ({
      id: `order-${order._id}`,
      type: "order",
      title: "Order placed",
      description: `${order.orderNumber} was placed for INR ${order.totalAmount.toFixed(2)}.`,
      timestamp: order.createdAt,
    })),
    ...recentAIEvents.map((event) => ({
      id: `ai-${event.id}`,
      type: "ai",
      title: "AI recommended product",
      description: `${event.productName || "A product"} was recommended${event.category ? ` in ${event.category}` : ""}.`,
      timestamp: event.timestamp,
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  res.json({
    success: true,
    dashboard: {
      totalRevenue,
      totalOrders,
      totalUsers,
      pageViews: 89234,
      totalAIRecommendationsServed,
      aiConversionRate,
      totalSearches: await SearchLog.countDocuments(),
      metricTrends: {
        revenue: buildMetricTrend(currentRevenue, previousRevenue),
        orders: buildMetricTrend(currentOrders, previousOrders),
        users: buildMetricTrend(currentUsers, previousUsers),
        aiRecommendations: buildMetricTrend(currentRecommendations, previousRecommendations),
        conversionRate: buildMetricTrend(currentConversionRate, previousConversionRate),
      },
      revenueTrend,
      ordersTrend,
      searchTrend,
      recentOrders,
      topProducts,
      topSearchTerms,
      activityFeed,
      insights: {
        mostSearchedTerm: topSearchTerm,
        mostPopularCategory,
        highestConversionProduct,
      },
    },
  });
});

const getAIAnalytics = asyncHandler(async (_req, res) => {
  const [
    recommendationsServed,
    purchasesSummary,
    topSearchTerms,
    totalSearches,
    searchTrend,
    categoryInterest,
    mostRecommendedProducts,
  ] = await Promise.all([
    AIEvent.aggregate([
      { $match: { eventType: "recommendation" } },
      { $count: "count" },
    ]),
    AIEvent.aggregate([
      { $match: { eventType: "purchase" } },
      {
        $group: {
          _id: null,
          purchases: { $sum: 1 },
          revenue: { $sum: "$revenue" },
        },
      },
    ]),
    SearchLog.aggregate([
      {
        $project: {
          normalizedTerm: {
            $trim: {
              input: {
                $toLower: {
                  $ifNull: ["$term", "$query"],
                },
              },
            },
          },
        },
      },
      {
        $match: {
          normalizedTerm: { $ne: "" },
        },
      },
      {
        $group: {
          _id: "$normalizedTerm",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          term: "$_id",
          count: 1,
        },
      },
    ]),
    SearchLog.countDocuments({
      $or: [
        { term: { $exists: true, $ne: "" } },
        { query: { $exists: true, $ne: "" } },
      ],
    }),
    SearchLog.aggregate([
      {
        $match: {
          createdAt: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: 1,
        },
      },
    ]),
    AIEvent.aggregate([
      { $match: { eventType: "recommendation" } },
      ...RECOMMENDATION_CATEGORY_PIPELINE,
      {
        $group: {
          _id: "$category",
          value: { $sum: 1 },
        },
      },
      { $sort: { value: -1, _id: 1 } },
      {
        $project: {
          _id: 0,
          name: "$_id",
          value: 1,
        },
      },
    ]),
    AIEvent.aggregate([
      {
        $match: {
          eventType: "recommendation",
          productId: { $exists: true, $ne: null },
        },
      },
      ...RECOMMENDATION_CATEGORY_PIPELINE,
      {
        $addFields: {
          normalizedSnapshotName: buildTrimmedStringExpression("$productSnapshot.name"),
          normalizedSnapshotBrand: buildTrimmedStringExpression("$productSnapshot.brand"),
          normalizedSnapshotCategory: buildNormalizedCategoryExpression("$productSnapshot.category"),
          normalizedSnapshotImage: buildTrimmedStringExpression("$productSnapshot.image"),
        },
      },
      {
        $addFields: {
          snapshotCompleteness: {
            $add: [
              { $cond: [{ $ne: ["$normalizedSnapshotName", ""] }, 4, 0] },
              { $cond: [{ $ne: ["$normalizedSnapshotBrand", ""] }, 2, 0] },
              { $cond: [{ $ne: ["$normalizedSnapshotImage", ""] }, 1, 0] },
            ],
          },
        },
      },
      { $sort: { snapshotCompleteness: -1, timestamp: -1 } },
      {
        $group: {
          _id: "$productId",
          recommendationCount: { $sum: 1 },
          category: { $first: "$category" },
          snapshot: {
            $first: {
              name: "$normalizedSnapshotName",
              brand: "$normalizedSnapshotBrand",
              category: "$normalizedSnapshotCategory",
              image: "$normalizedSnapshotImage",
            },
          },
        },
      },
      {
        $lookup: {
          from: "products",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$_id", "$$productId"] },
                    {
                      $eq: [{ $toString: "$_id" }, { $toString: "$$productId" }],
                    },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                brand: 1,
                category: 1,
                image: 1,
              },
            },
          ],
          as: "product",
        },
      },
      {
        $addFields: {
          product: { $first: "$product" },
        },
      },
      {
        $lookup: {
          from: "orders",
          let: { productId: "$_id" },
          pipeline: [
            { $unwind: "$products" },
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$products.productId", "$$productId"] },
                    {
                      $eq: [{ $toString: "$products.productId" }, { $toString: "$$productId" }],
                    },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                name: "$products.name",
                brand: "$products.brand",
                image: "$products.image",
              },
            },
          ],
          as: "orderProduct",
        },
      },
      {
        $addFields: {
          orderProduct: { $first: "$orderProduct" },
          resolvedName: buildFirstNonEmptyStringExpression(
            [
              buildTrimmedStringExpression("$product.name"),
              buildTrimmedStringExpression("$snapshot.name"),
              buildTrimmedStringExpression("$orderProduct.name"),
            ],
            "Archived product"
          ),
          resolvedBrand: buildFirstNonEmptyStringExpression(
            [
              buildTrimmedStringExpression("$product.brand"),
              buildTrimmedStringExpression("$snapshot.brand"),
              buildTrimmedStringExpression("$orderProduct.brand"),
            ],
            "Unavailable"
          ),
          resolvedCategory: buildFirstNonEmptyStringExpression(
            [
              buildNormalizedCategoryExpression("$product.category"),
              buildNormalizedCategoryExpression("$snapshot.category"),
              buildNormalizedCategoryExpression("$category"),
            ],
            "uncategorized"
          ),
          resolvedImage: buildFirstNonEmptyStringExpression(
            [
              buildTrimmedStringExpression("$product.image"),
              buildTrimmedStringExpression("$snapshot.image"),
              buildTrimmedStringExpression("$orderProduct.image"),
            ],
            ""
          ),
        },
      },
      {
        $match: {
          resolvedName: { $ne: "Archived product" },
        },
      },
      { $sort: { recommendationCount: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          productId: {
            $toString: {
              $ifNull: ["$product._id", "$_id"],
            },
          },
          name: "$resolvedName",
          brand: "$resolvedBrand",
          category: "$resolvedCategory",
          image: "$resolvedImage",
          recommendationCount: 1,
        },
      },
    ]),
  ]);

  const totalRecommendationsServed = recommendationsServed[0]?.count || 0;
  const totalPurchases = purchasesSummary[0]?.purchases || 0;
  const aiDrivenRevenue = purchasesSummary[0]?.revenue || 0;
  const mostSearchedTerms = topSearchTerms;
  const recommendedProductIds = Array.from(
    new Set(
      mostRecommendedProducts
        .map((item) => String(item.productId || "").trim())
        .filter(Boolean)
    )
  );
  const populatedRecommendationEvents = recommendedProductIds.length
    ? await AIEvent.find({
        eventType: "recommendation",
        productId: { $in: recommendedProductIds },
      })
        .select("productId")
        .populate("productId", "_id name brand category image")
        .lean()
    : [];
  const populatedProductsById = new Map(
    populatedRecommendationEvents
      .map((event) => event.productId)
      .filter((product) => product && product._id)
      .map((product) => {
        const normalizedId = String(product._id);

        return [
          normalizedId,
          {
            name: typeof product.name === "string" ? product.name.trim() : "",
            brand: typeof product.brand === "string" ? product.brand.trim() : "",
            category: typeof product.category === "string" ? product.category.trim() : "",
            image: typeof product.image === "string" ? product.image.trim() : "",
          },
        ];
      })
  );
  const resolvedMostRecommendedProducts = mostRecommendedProducts.map((item) => {
    const populatedProduct = populatedProductsById.get(String(item.productId || "").trim());

    return {
      ...item,
      name: populatedProduct?.name || item.name,
      brand: populatedProduct?.brand || item.brand,
      category: populatedProduct?.category || item.category,
      image: populatedProduct?.image || item.image,
    };
  });
  const aiConversionRate = totalRecommendationsServed
    ? Number(((totalPurchases / totalRecommendationsServed) * 100).toFixed(2))
    : 0;

  res.json({
    success: true,
    analytics: {
      totalAIRecommendationsServed: totalRecommendationsServed,
      aiConversionRate,
      aiDrivenRevenue,
      totalSearches,
      topSearchTerms,
      searchTrend,
      categoryInterest,
      mostSearchedTerms,
      mostRecommendedProducts: resolvedMostRecommendedProducts,
    },
  });
});

const getUsers = asyncHandler(async (_req, res) => {
  const users = await User.aggregate([
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "userId",
        as: "orders",
      },
    },
    {
      $addFields: {
        totalOrders: { $size: "$orders" },
        totalSpent: {
          $sum: {
            $map: {
              input: "$orders",
              as: "order",
              in: "$$order.totalAmount",
            },
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        name: 1,
        email: 1,
        role: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        totalOrders: 1,
        totalSpent: 1,
      },
    },
    { $sort: { createdAt: -1 } },
  ]);

  res.json({
    success: true,
    count: users.length,
    users,
  });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!status) {
    res.status(400);
    throw new Error("status is required.");
  }

  if (req.user?._id?.toString() === req.params.id) {
    res.status(400);
    throw new Error("You cannot change your own account status.");
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  );

  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  res.json({
    success: true,
    message: "User status updated successfully.",
    user,
  });
});

const getContactQueries = asyncHandler(async (_req, res) => {
  const queries = await ContactQuery.find({ type: "contact" }).sort({ createdAt: -1 });

  res.json({
    success: true,
    count: queries.length,
    queries,
  });
});

const updateContactQuery = asyncHandler(async (req, res) => {
  const query = await ContactQuery.findOne({ _id: req.params.id, type: "contact" });

  if (!query) {
    res.status(404);
    throw new Error("Customer query not found.");
  }

  const hasStatus = Object.prototype.hasOwnProperty.call(req.body, "status");
  const hasAdminReply = Object.prototype.hasOwnProperty.call(req.body, "adminReply");

  if (!hasStatus && !hasAdminReply) {
    res.status(400);
    throw new Error("status or adminReply is required.");
  }

  let nextStatus = query.status;

  if (hasStatus) {
    const normalizedStatus = String(req.body.status || "")
      .trim()
      .toLowerCase();

    if (!CONTACT_QUERY_STATUSES.has(normalizedStatus)) {
      res.status(400);
      throw new Error("Invalid query status.");
    }

    nextStatus = normalizedStatus;
  }

  let nextReply = query.adminReply || "";

  if (hasAdminReply) {
    nextReply = String(req.body.adminReply || "").trim();

    if (!hasStatus && nextReply && query.status === "pending") {
      nextStatus = "replied";
    }
  }

  query.status = nextStatus;
  query.adminReply = nextReply;

  if (nextStatus === "resolved" || nextStatus === "closed") {
    query.resolvedAt = new Date();
  } else {
    query.resolvedAt = null;
  }

  if (nextReply && ["replied", "resolved", "closed"].includes(nextStatus)) {
    query.repliedAt = query.repliedAt || new Date();
  } else if (!nextReply || nextStatus === "pending") {
    query.repliedAt = null;
  }

  query.handledBy = {
    userId: req.user?._id,
    name: req.user?.name || "",
    email: req.user?.email || "",
  };

  await query.save();

  res.json({
    success: true,
    message: "Customer query updated successfully.",
    query,
  });
});

const deleteContactQuery = asyncHandler(async (req, res) => {
  const query = await ContactQuery.findOneAndDelete({ _id: req.params.id, type: "contact" });

  if (!query) {
    res.status(404);
    throw new Error("Customer query not found.");
  }

  res.json({
    success: true,
    message: "Customer query deleted successfully.",
  });
});

const getChatQueries = asyncHandler(async (_req, res) => {
  const queries = await ChatQuery.find({})
    .populate("userId", "name email")
    .sort({ timestamp: -1 });

  res.json({
    success: true,
    count: queries.length,
    queries,
  });
});

module.exports = {
  getDashboard,
  getAIAnalytics,
  getUsers,
  updateUserStatus,
  getContactQueries,
  updateContactQuery,
  deleteContactQuery,
  getChatQueries,
};

