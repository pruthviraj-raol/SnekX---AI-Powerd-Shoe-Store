const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const ChatQuery = require("../models/ChatQuery");
const AIEvent = require("../models/AIEvent");
const Product = require("../models/Product");
const Order = require("../models/Order");
const asyncHandler = require("../middleware/asyncHandler");
const { buildAIEventProductSnapshot } = require("../services/aiEventSnapshotService");
const {
  detectDominantColor,
  findChatbotRecommendations,
  buildChatbotReply,
} = require("../services/aiService");

const normalizeAiServiceUrl = (value = "") => String(value).trim().replace(/\/$/, "");

const getAiServiceUrl = (pathname) => {
  const aiServiceUrl = normalizeAiServiceUrl(process.env.AI_SERVICE_URL);

  if (!aiServiceUrl) {
    throw new Error("AI_SERVICE_URL is not configured.");
  }

  return `${aiServiceUrl}${pathname}`;
};
const DEFAULT_PRODUCT_CHAT_FALLBACK = "I couldn't reach the AI service, but here are some shoes you may like.";
const DEFAULT_GENERAL_CHAT_FALLBACK =
  "I couldn't reach the AI service just now, but I'm still here to help with shoe suggestions or order tracking.";
const ORDER_ID_REGEX = /\bORD-[A-Z]+-\d+\b/i;
const ORDER_TRACKING_KEYWORD_REGEX = /\b(track|tracking|where|status|shipped|delivery|delivered|package)\b/i;
const GREETING_KEYWORD_REGEX = /\b(hi|hello|hey|yo|good morning|good afternoon|good evening)\b/i;
const HELP_KEYWORD_REGEX = /\b(help|assist|support|what can you do|how can you help)\b/i;
const PRODUCT_SEARCH_KEYWORD_REGEX = /\b(shoe|shoes|sneaker|sneakers|show|suggest|recommend)\b/i;
const STYLIST_START_REGEX = /\b(suggest|recommend|help me choose|shoe|shoes|sneaker|sneakers)\b/i;
const STYLIST_SKIP_REGEX =
  /\b(skip|any|no preference|no pref|whatever|surprise me|don't care|doesn't matter|doesn t matter)\b/i;
const ORDER_CONTEXT_TTL_MS = 15 * 60 * 1000;
const KNOWN_STYLIST_COLORS = [
  "black",
  "white",
  "blue",
  "red",
  "green",
  "yellow",
  "brown",
  "tan",
  "grey",
  "gray",
  "purple",
  "pink",
  "orange",
  "beige",
];
const STYLIST_STEP_PROMPTS = {
  ask_occasion: "What's the occasion? (party, gym, running, office, daily, wedding, travel)",
  ask_color: "Any color preference?",
  ask_budget: "What's your budget?",
};
const STYLIST_OCCASION_FILTERS = {
  party: {
    category: ["formal"],
    type: ["loafers", "sneakers"],
  },
  gym: {
    category: ["sports"],
    type: ["training"],
  },
  running: {
    category: ["sports"],
    type: ["running"],
  },
  office: {
    category: ["formal"],
    type: ["oxford", "derby"],
  },
  daily: {
    category: ["casual"],
    type: ["lifestyle", "walking"],
  },
  wedding: {
    category: ["ethnic", "formal"],
    type: ["sandals", "loafers"],
  },
  travel: {
    category: ["outdoor"],
    type: ["hiking"],
  },
};
const chatbotSessions = new Map();
const sessions = {};
const OUTFIT_CATEGORY_HINTS = {
  formal: "formal",
  casual: "casual",
  sports: "sports",
  "smart casual": "casual",
  streetwear: "casual",
  outdoor: "outdoor",
  ethnic: "ethnic",
};
const ETHNIC_OUTFIT_SIGNAL_REGEX = /\b(kurta|sherwani|achkan|bandhgala|ethnic|traditional|wedding|festive)\b/i;
const OUTDOOR_OUTFIT_SIGNAL_REGEX = /\b(hike|hiking|trek|trekking|trail|outdoor|mountain|camp|camping)\b/i;
const SPORTS_OUTFIT_SIGNAL_REGEX =
  /\b(gym|sports?|sportswear|running|run|runner|jog|jogging|marathon|track|tracksuit|training|workout|fitness|athlete|athletic|activewear|basketball|compression|leggings|performance tee|training shorts|gym shorts|dry fit|dri fit)\b/i;
const FORMAL_OUTFIT_SIGNAL_REGEX = /\b(formal|office|blazer|business|suit)\b/i;
const OUTFIT_TYPE_HINTS = {
  formal: ["oxford", "derby", "loafers"],
  casual: ["sneakers", "lifestyle", "walking", "slip-on"],
  sports: ["running", "training", "basketball"],
  outdoor: ["hiking"],
  ethnic: ["sandals", "loafers"],
  "smart casual": ["sneakers", "loafers", "slip-on", "walking"],
  streetwear: ["sneakers", "lifestyle"],
  "t-shirt": ["sneakers", "lifestyle", "walking"],
  hoodie: ["sneakers", "lifestyle"],
  jeans: ["sneakers", "lifestyle", "walking"],
  dress: ["loafers", "oxford", "derby", "sandals"],
  jacket: ["sneakers", "lifestyle", "walking"],
  suit: ["oxford", "derby", "loafers"],
  blazer: ["oxford", "derby", "loafers"],
  shirt: ["oxford", "derby", "loafers"],
  shorts: ["training", "running"],
  skirt: ["sneakers", "sandals", "slip-on"],
  tracksuit: ["running", "training", "basketball"],
  activewear: ["running", "training"],
  "athletic t shirt": ["running", "training"],
  "compression top": ["training", "running"],
  kurta: ["sandals", "loafers"],
  sherwani: ["sandals", "loafers"],
  "traditional wear": ["sandals", "loafers"],
  "gym shorts": ["training", "running"],
  leggings: ["training", "running"],
  shoe: ["sneakers", "lifestyle", "walking"],
  "casual wear": ["sneakers", "lifestyle", "walking"],
};
const ETHNIC_SECONDARY_TYPES = ["loafers", "derby", "oxford"];
const ETHNIC_TRADITIONAL_FOOTWEAR_REGEX = /\b(jutti|jutti|mojari|mojri|kolhapuri|traditional|ethnic|wedding)\b/i;
const OUTFIT_CATEGORY_FALLBACKS = {
  casual: ["formal"],
  formal: ["casual", "ethnic"],
  sports: ["casual"],
  outdoor: ["sports", "casual"],
  ethnic: ["formal", "casual"],
};
const DEFAULT_RECOMMENDED_SHOE_COLORS = {
  casual: ["white", "black", "grey"],
  formal: ["black", "brown", "tan"],
  sports: ["white", "black", "blue"],
  outdoor: ["brown", "tan", "black"],
  ethnic: ["tan", "brown", "cream", "gold"],
};
const OUTFIT_COLOR_COMPATIBILITY = {
  black: ["black", "white", "grey", "tan", "brown", "cream", "gold", "red", "blue"],
  white: ["white", "black", "grey", "blue", "brown", "tan", "cream", "green"],
  grey: ["grey", "white", "black", "blue", "tan", "red", "green"],
  blue: ["white", "black", "grey", "tan", "brown", "cream"],
  red: ["white", "black", "grey", "blue", "cream"],
  green: ["white", "black", "tan", "brown", "cream", "grey"],
  yellow: ["white", "black", "blue", "brown", "tan", "grey"],
  orange: ["white", "black", "blue", "brown", "tan"],
  purple: ["white", "black", "grey", "cream", "gold"],
  pink: ["white", "black", "grey", "cream"],
  brown: ["brown", "tan", "black", "cream", "white", "green"],
  tan: ["tan", "brown", "white", "black", "cream", "green", "blue"],
  cream: ["cream", "brown", "tan", "gold", "black", "white"],
  gold: ["gold", "cream", "brown", "black", "tan"],
};
const NEUTRAL_OUTFIT_COLORS = new Set(["black", "white", "grey", "brown", "tan", "cream", "gold"]);
const VALID_OUTFIT_CATEGORIES = ["formal", "casual", "sports", "ethnic"];
const STRICT_CATEGORY_ALLOWED_TYPES = {
  formal: ["oxford", "derby", "loafers"],
  casual: ["sneakers"],
  sports: ["running", "training"],
  ethnic: ["slip-on", "loafers", "sandals"],
};

const isRemoteUploadPath = (filePath = "") => /^https?:\/\//i.test(filePath);

const getUploadedImageBuffer = async (file) => {
  if (file?.buffer) {
    return file.buffer;
  }

  if (isRemoteUploadPath(file?.path)) {
    const response = await axios.get(file.path, {
      responseType: "arraybuffer",
      timeout: 10000,
    });

    return Buffer.from(response.data);
  }

  return fs.promises.readFile(file.path);
};

const cleanupUpload = (filePath) => {
  if (filePath && !isRemoteUploadPath(filePath) && fs.existsSync(filePath)) {
    fs.unlink(filePath, () => {});
  }
};

const recordRecommendationEvents = async (products, userId) => {
  if (!products.length) {
    return;
  }

  const events = products
    .map((product) => {
      const productId = product?._id || product?.id || null;

      if (!productId) {
        return null;
      }

      return {
        userId: userId || null,
        productId,
        eventType: "recommendation",
        category: product.category,
        productSnapshot: buildAIEventProductSnapshot(product),
        clicked: false,
        purchased: false,
        timestamp: new Date(),
      };
    })
    .filter(Boolean);

  if (!events.length) {
    return;
  }

  await AIEvent.insertMany(events);
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const uniqueValues = (values = []) => [...new Set(values.filter(Boolean))];

const normalizeOutfitValue = (value = "") => String(value).trim().toLowerCase();
const normalizeOutfitText = (value = "") => normalizeOutfitValue(value).replace(/[_-]+/g, " ");
const normalizeOutfitColor = (value = "") => {
  const normalizedColor = normalizeOutfitValue(value);

  if (normalizedColor === "gray" || normalizedColor === "silver") {
    return "grey";
  }

  if (normalizedColor === "beige") {
    return "tan";
  }

  if (normalizedColor === "golden") {
    return "gold";
  }

  return normalizedColor;
};

const normalizeSemanticOutfitCategory = (value = "") => {
  const normalizedCategory = normalizeOutfitValue(value);
  return VALID_OUTFIT_CATEGORIES.includes(normalizedCategory) ? normalizedCategory : "casual";
};

const getStrictOutfitStyle = (category = "") => `${normalizeSemanticOutfitCategory(category)} outfit`;

const getStyleRecommendationConstraints = ({ style = "", category = "", allowedTypes = [] } = {}) => {
  const normalizedStyle = normalizeOutfitValue(style);
  const normalizedCategory = normalizeOutfitValue(category);
  const normalizedAllowedTypes = Array.isArray(allowedTypes)
    ? [...new Set(allowedTypes.map((type) => normalizeOutfitValue(type)).filter(Boolean))]
    : [];

  if (normalizedStyle.includes("formal") || normalizedStyle.includes("office")) {
    return {
      style: normalizedStyle,
      category: "formal",
      allowedTypes: ["oxford", "derby", "loafers"],
    };
  }

  if (normalizedStyle.includes("sports") || normalizedStyle.includes("gym")) {
    return {
      style: normalizedStyle,
      category: "sports",
      allowedTypes: ["running", "training", "basketball"],
    };
  }

  if (normalizedStyle.includes("outdoor") || normalizedStyle.includes("hiking") || normalizedStyle.includes("trek")) {
    return {
      style: normalizedStyle,
      category: "outdoor",
      allowedTypes: ["hiking"],
    };
  }

  if (
    normalizedStyle.includes("ethnic") ||
    normalizedStyle.includes("traditional") ||
    normalizedStyle.includes("kurta") ||
    normalizedStyle.includes("sherwani") ||
    normalizedStyle.includes("wedding") ||
    normalizedStyle.includes("festive")
  ) {
    return {
      style: normalizedStyle,
      category: "ethnic",
      allowedTypes: ["sandals", "loafers"],
    };
  }

  if (normalizedStyle.includes("smart casual")) {
    return {
      style: normalizedStyle,
      category: "casual",
      allowedTypes: ["sneakers", "loafers", "slip-on", "walking"],
    };
  }

  if (normalizedStyle.includes("streetwear")) {
    return {
      style: normalizedStyle,
      category: "casual",
      allowedTypes: ["sneakers", "lifestyle"],
    };
  }

  if (normalizedStyle.includes("party")) {
    return {
      style: normalizedStyle,
      category: "formal",
      allowedTypes: ["loafers", "derby", "oxford"],
    };
  }

  if (normalizedAllowedTypes.length > 0 && ["formal", "casual", "sports", "outdoor", "ethnic"].includes(normalizedCategory)) {
    return {
      style: normalizedStyle,
      category: normalizedCategory,
      allowedTypes: normalizedAllowedTypes,
    };
  }

  if (normalizedCategory === "formal") {
    return {
      style: normalizedStyle,
      category: "formal",
      allowedTypes: ["oxford", "derby", "loafers"],
    };
  }

  if (normalizedCategory === "sports") {
    return {
      style: normalizedStyle,
      category: "sports",
      allowedTypes: ["running", "training", "basketball"],
    };
  }

  if (normalizedCategory === "outdoor") {
    return {
      style: normalizedStyle,
      category: "outdoor",
      allowedTypes: ["hiking"],
    };
  }

  if (normalizedCategory === "ethnic") {
    return {
      style: normalizedStyle,
      category: "ethnic",
      allowedTypes: ["sandals", "loafers"],
    };
  }

  return {
    style: normalizedStyle,
    category: "casual",
    allowedTypes: ["sneakers", "walking", "lifestyle", "slip-on"],
  };
};

const normalizeDetectedClothingType = (clothingType = "", filename = "") => {
  const normalizedClothingType = normalizeOutfitText(clothingType);
  const normalizedFilename = normalizeOutfitText(filename).replace(/\.[a-z0-9]+$/i, "");
  const detectionText = [normalizedClothingType, normalizedFilename].filter(Boolean).join(" ");

  if (!detectionText) {
    return "casual";
  }

  if (OUTFIT_CATEGORY_HINTS[detectionText]) {
    return OUTFIT_CATEGORY_HINTS[detectionText];
  }

  if (ETHNIC_OUTFIT_SIGNAL_REGEX.test(detectionText)) {
    return "ethnic";
  }

  if (OUTDOOR_OUTFIT_SIGNAL_REGEX.test(detectionText)) {
    return "outdoor";
  }

  if (SPORTS_OUTFIT_SIGNAL_REGEX.test(detectionText) || /\b(sneakers?|running shoe)\b/.test(detectionText)) {
    return "sports";
  }

  if (FORMAL_OUTFIT_SIGNAL_REGEX.test(detectionText)) {
    return "formal";
  }

  if (/\b(hoodie|jeans|t-shirt|tshirt|streetwear|jacket)\b/.test(detectionText)) {
    return "casual";
  }

  return "casual";
};

const resolveOutfitStyle = ({ style = "", clothingType = "", category = "", filename = "" } = {}) => {
  const normalizedStyle = normalizeOutfitText(style);
  const normalizedClothingType = normalizeOutfitText(clothingType);
  const normalizedFilename = normalizeOutfitText(filename).replace(/\.[a-z0-9]+$/i, "");
  const normalizedCategory = normalizeOutfitValue(category);
  const detectionText = [normalizedClothingType, normalizedStyle, normalizedFilename].filter(Boolean).join(" ");

  if (ETHNIC_OUTFIT_SIGNAL_REGEX.test(detectionText) || normalizedCategory === "ethnic") {
    return "ethnic outfit";
  }

  if (OUTDOOR_OUTFIT_SIGNAL_REGEX.test(detectionText) || normalizedCategory === "outdoor") {
    return "outdoor outfit";
  }

  if (SPORTS_OUTFIT_SIGNAL_REGEX.test(detectionText) || normalizedCategory === "sports") {
    return "sports outfit";
  }

  if (normalizedStyle.includes("street")) {
    return "streetwear outfit";
  }

  if (normalizedStyle.includes("party")) {
    return "party outfit";
  }

  if (normalizedStyle.includes("smart casual")) {
    return "smart casual outfit";
  }

  if (normalizedStyle.includes("formal") || (FORMAL_OUTFIT_SIGNAL_REGEX.test(detectionText) && !OUTDOOR_OUTFIT_SIGNAL_REGEX.test(detectionText) && !SPORTS_OUTFIT_SIGNAL_REGEX.test(detectionText))) {
    return "formal outfit";
  }

  if (normalizedStyle.includes("casual")) {
    return "casual outfit";
  }

  if (normalizedCategory === "formal") {
    return "formal outfit";
  }

  if (normalizedCategory === "casual") {
    return "casual outfit";
  }

  return normalizedStyle || (normalizedCategory ? `${normalizedCategory} outfit` : "casual outfit");
};

const inferOutfitTypeHints = (clothingType = "", mappedCategory = "casual") => {
  const normalizedClothingType = normalizeOutfitValue(clothingType);

  if (!normalizedClothingType) {
    return uniqueValues(OUTFIT_TYPE_HINTS[mappedCategory] || []);
  }

  if (OUTFIT_TYPE_HINTS[normalizedClothingType]) {
    return OUTFIT_TYPE_HINTS[normalizedClothingType];
  }

  if (/\b(running|run|jog|marathon|track)\b/.test(normalizedClothingType)) {
    return ["running"];
  }

  if (/\b(gym|workout|training|fitness|compression|leggings|activewear|athletic|performance)\b/.test(normalizedClothingType)) {
    return ["training"];
  }

  if (/\b(hoodie|streetwear|oversized)\b/.test(normalizedClothingType)) {
    return ["sneakers", "lifestyle"];
  }

  if (/\b(blazer|suit|office)\b/.test(normalizedClothingType)) {
    return ["oxford", "derby", "loafers"];
  }

  if (/\b(kurta|sherwani|achkan|bandhgala|ethnic|traditional|wedding|festive)\b/.test(normalizedClothingType)) {
    return ["sandals", "loafers"];
  }

  if (/\b(hiking|trek|trail|outdoor)\b/.test(normalizedClothingType)) {
    return ["hiking"];
  }

  if (/\b(basketball|court)\b/.test(normalizedClothingType)) {
    return ["basketball"];
  }

  if (/\b(football|soccer|cleat)\b/.test(normalizedClothingType)) {
    return ["football"];
  }

  return uniqueValues(OUTFIT_TYPE_HINTS[mappedCategory] || []);
};

const buildOutfitFilter = ({ clothingType, color, filename } = {}) => {
  const filter = {};
  const mappedCategory = normalizeDetectedClothingType(clothingType, filename);
  const normalizedColor = normalizeOutfitColor(color);

  console.log("FINAL CATEGORY:", mappedCategory);

  filter.category = mappedCategory;

  if (normalizedColor) {
    filter.colors = { $in: [normalizedColor] };
  }

  return {
    filter,
    mappedCategory,
    normalizedColor,
    typeHints: inferOutfitTypeHints(clothingType, mappedCategory),
  };
};

const FORMAL_OUTFIT_TYPES = ["oxford", "derby", "loafers"];
const SPORTS_OUTFIT_TYPES = ["running", "training", "basketball"];
const STRONG_OUTFIT_MATCH_THRESHOLD = 72;

const getOutfitCategoryQuery = (mappedCategory = "") => {
  const query = { category: mappedCategory || "casual" };

  if (query.category === "formal") {
    query.type = { $in: FORMAL_OUTFIT_TYPES };
  }

  if (query.category === "sports") {
    query.type = { $in: SPORTS_OUTFIT_TYPES };
  }

  return query;
};

const hasLowercaseProductTaxonomy = (product = {}) => {
  const productCategory = normalizeOutfitValue(product.category);
  const productColors = Array.isArray(product.colors) ? product.colors : [];

  return (
    Boolean(productCategory) &&
    product.category === productCategory &&
    productColors.length > 0 &&
    productColors.every((productColor) => productColor === normalizeOutfitValue(productColor))
  );
};

const finalizeOutfitProducts = (products = [], mappedCategory = "") => {
  products = products.filter((product) => hasLowercaseProductTaxonomy(product));
  products = products.filter((p) => p.category === mappedCategory);
  console.log("FINAL PRODUCTS:", products.map((p) => p.category));
  return products;
};

const hasColorMatch = (product, normalizedColor) => {
  if (!normalizedColor) {
    return false;
  }

  const productColors = Array.isArray(product.colors) ? product.colors : [];
  return productColors.includes(normalizedColor) || product.color === normalizedColor;
};

const hasTypeMatch = (product, typeHints = []) => typeHints.includes(product.type);

const isAllowedOutfitType = (product, mappedCategory) => {
  if (mappedCategory === "formal") {
    return FORMAL_OUTFIT_TYPES.includes(product.type);
  }

  if (mappedCategory === "sports") {
    return SPORTS_OUTFIT_TYPES.includes(product.type);
  }

  return true;
};

const calculateOutfitScore = (product, { mappedCategory, normalizedColor, typeHints }) => {
  if (!mappedCategory || product.category !== mappedCategory) {
    return 0;
  }

  if (!isAllowedOutfitType(product, mappedCategory)) {
    return 0;
  }

  let score = 60;

  if (hasTypeMatch(product, typeHints)) {
    score += 25;
  }

  if (hasColorMatch(product, normalizedColor)) {
    score += 15;
  }

  return score;
};

const convertOutfitScoreToPercentage = (score) => {
  if (score < STRONG_OUTFIT_MATCH_THRESHOLD) {
    return 0;
  }

  if (score >= 100) {
    return 98;
  }

  return Math.min(98, Math.round(78 + ((score - STRONG_OUTFIT_MATCH_THRESHOLD) / 28) * 18));
};

const decorateOutfitProducts = (products, outfitSignals, { isAlternative = false } = {}) =>
  products.map((product) => {
    const score = isAlternative ? 0 : calculateOutfitScore(product, outfitSignals);
    const matchPercentage = isAlternative ? 0 : convertOutfitScoreToPercentage(score);

    return {
      ...product.toObject(),
      matchScore: score,
      matchPercentage,
      isAlternative,
    };
  });

const rankOutfitProducts = (products, outfitSignals) =>
  products
    .slice()
    .sort((left, right) => {
      const scoreDifference =
        calculateOutfitScore(right, outfitSignals) - calculateOutfitScore(left, outfitSignals);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const trendingDifference = Number(right.isTrending) - Number(left.isTrending);
      if (trendingDifference !== 0) {
        return trendingDifference;
      }

      const stockDifference = (right.stock || 0) - (left.stock || 0);
      if (stockDifference !== 0) {
        return stockDifference;
      }

      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    });

const humanizeOutfitValue = (value = "") =>
  normalizeOutfitValue(value)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const normalizeOutfitRgb = (rgb = null) => {
  if (!rgb || typeof rgb !== "object") {
    return null;
  }

  const r = Number(rgb.r);
  const g = Number(rgb.g);
  const b = Number(rgb.b);

  if (![r, g, b].every(Number.isFinite)) {
    return null;
  }

  return {
    r: Math.max(0, Math.min(255, Math.round(r))),
    g: Math.max(0, Math.min(255, Math.round(g))),
    b: Math.max(0, Math.min(255, Math.round(b))),
  };
};

const normalizeOutfitPalette = (palette = [], dominantColor = "", rgb = null) => {
  const paletteMap = new Map();

  if (Array.isArray(palette)) {
    for (const entry of palette) {
      const normalizedColor = normalizeOutfitColor(entry?.color || "");

      if (!normalizedColor) {
        continue;
      }

      const share = Number(entry?.share);
      const normalizedEntry = {
        color: normalizedColor,
        share: Number.isFinite(share) ? Math.max(0, Math.min(1, share)) : 0,
      };
      const existingEntry = paletteMap.get(normalizedColor);

      if (!existingEntry || normalizedEntry.share > existingEntry.share) {
        paletteMap.set(normalizedColor, normalizedEntry);
      }
    }
  }

  const normalizedPalette = [...paletteMap.values()].sort((left, right) => right.share - left.share);
  const normalizedDominantColor = normalizeOutfitColor(dominantColor);

  if (normalizedDominantColor && !normalizedPalette.some((entry) => entry.color === normalizedDominantColor)) {
    normalizedPalette.unshift({
      color: normalizedDominantColor,
      share: normalizedPalette.length ? Math.max(normalizedPalette[0].share, 0.35) : 1,
    });
  }

  if (!normalizedPalette.length && normalizedDominantColor) {
    normalizedPalette.push({
      color: normalizedDominantColor,
      share: 1,
    });
  }

  const normalizedRgb = normalizeOutfitRgb(rgb);

  if (normalizedPalette[0] && normalizedRgb) {
    normalizedPalette[0].rgb = normalizedRgb;
  }

  return normalizedPalette.slice(0, 4);
};

const getCompatibleOutfitColors = (dominantColor, paletteColors = [], category = "casual") =>
  uniqueValues([
    ...[dominantColor, ...paletteColors]
      .map((color) => normalizeOutfitColor(color))
      .flatMap((color) => OUTFIT_COLOR_COMPATIBILITY[color] || []),
    ...(DEFAULT_RECOMMENDED_SHOE_COLORS[category] || []),
  ]);

const buildOutfitReasoning = ({
  clothingType = "",
  style = "",
  dominantColor = "",
  palette = [],
  allowedTypes = [],
  recommendedShoeColors = [],
}) => {
  const paletteText =
    palette
      .slice(0, 3)
      .map((entry) => humanizeOutfitValue(entry.color))
      .join(", ") || humanizeOutfitValue(dominantColor) || "Neutral";
  const shoeTypeText =
    allowedTypes
      .slice(0, 3)
      .map((type) => humanizeOutfitValue(type))
      .join(", ") || "Versatile shoes";
  const shoeColorText =
    recommendedShoeColors
      .slice(0, 3)
      .map((color) => humanizeOutfitValue(color))
      .join(", ") || humanizeOutfitValue(dominantColor) || "Neutral tones";

  return [
    `Detected ${humanizeOutfitValue(clothingType)} with a ${humanizeOutfitValue(style)} direction.`,
    `Dominant color is ${humanizeOutfitValue(dominantColor)} with palette notes of ${paletteText}.`,
    `Best shoe matches are ${shoeTypeText} in colors like ${shoeColorText}.`,
  ];
};

const buildOutfitAnalysis = ({
  clothingType = "",
  style = "",
  category = "",
  allowedTypes = [],
  color = "",
  dominantColor = "",
  palette = [],
  neutralShare = 0,
  recommendedShoeColors = [],
  reasoning = [],
  rgb = null,
  filename = "",
} = {}) => {
  const normalizedClothingType = normalizeOutfitText(clothingType);
  const normalizedCategory = normalizeSemanticOutfitCategory(category);
  const normalizedDominantColor = normalizeOutfitColor(dominantColor || color);
  const resolvedStyle = getStrictOutfitStyle(normalizedCategory);
  const normalizedAllowedTypes = STRICT_CATEGORY_ALLOWED_TYPES[normalizedCategory];
  const normalizedPalette = normalizeOutfitPalette(palette, normalizedDominantColor, rgb);
  const paletteColors = uniqueValues(normalizedPalette.map((entry) => entry.color).filter(Boolean));
  const normalizedRecommendedColors = uniqueValues(
    (Array.isArray(recommendedShoeColors) ? recommendedShoeColors : [])
      .map((shoeColor) => normalizeOutfitColor(shoeColor))
      .filter(Boolean)
  );
  const suggestedShoeColors = uniqueValues([
    ...normalizedRecommendedColors,
    ...getCompatibleOutfitColors(normalizedDominantColor, paletteColors, normalizedCategory),
  ]).slice(0, 5);
  const derivedNeutralShare = normalizedPalette
    .filter((entry) => NEUTRAL_OUTFIT_COLORS.has(entry.color))
    .reduce((sum, entry) => sum + entry.share, 0);
  const safeNeutralShare = Number.isFinite(Number(neutralShare))
    ? Math.max(0, Math.min(1, Number(neutralShare)))
    : Math.min(1, derivedNeutralShare);
  const analysis = {
    clothingType: normalizedClothingType || resolvedStyle,
    style: resolvedStyle,
    category: normalizedCategory,
    allowedTypes: normalizedAllowedTypes,
    dominantColor: normalizedDominantColor || normalizedPalette[0]?.color || "",
    palette: normalizedPalette,
    neutralShare: safeNeutralShare,
    recommendedShoeColors: suggestedShoeColors,
    reasoning: Array.isArray(reasoning) && reasoning.filter(Boolean).length
      ? reasoning.filter(Boolean)
      : [],
    rgb: normalizeOutfitRgb(rgb),
  };

  if (!analysis.reasoning.length) {
    analysis.reasoning = buildOutfitReasoning(analysis);
  }

  return analysis;
};

const getProductColors = (product = {}) =>
  uniqueValues(
    [product.color, ...(Array.isArray(product.colors) ? product.colors : [])]
      .map((value) => normalizeOutfitColor(value))
      .filter(Boolean)
  );

const getProductSearchText = (product = {}) =>
  [product.name, product.description, ...(Array.isArray(product.tags) ? product.tags : [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const isTraditionalEthnicFootwear = (product = {}) =>
  product.category === "ethnic" &&
  product.type === "slip-on" &&
  ETHNIC_TRADITIONAL_FOOTWEAR_REGEX.test(getProductSearchText(product));

const serializeRecommendationProduct = (product, extras = {}) => {
  const baseProduct =
    typeof product?.toJSON === "function"
      ? product.toJSON()
      : typeof product?.toObject === "function"
        ? product.toObject()
        : { ...product };

  if (baseProduct?._id && !baseProduct.id) {
    baseProduct.id = String(baseProduct._id);
  }

  if (baseProduct && typeof baseProduct === "object") {
    delete baseProduct._id;
    delete baseProduct.__v;
  }

  return {
    ...baseProduct,
    ...extras,
  };
};

const getOutfitCategoryScore = (productCategory = "", outfitCategory = "") => {
  if (!productCategory || !outfitCategory) {
    return 0;
  }

  if (productCategory === outfitCategory) {
    return 46;
  }

  return (OUTFIT_CATEGORY_FALLBACKS[outfitCategory] || []).includes(productCategory) ? 24 : 0;
};

const getOutfitTypeScore = (product, analysis) => {
  if (analysis.allowedTypes.includes(product.type)) {
    return {
      score: 28,
      exact: true,
      traditional: false,
    };
  }

  if (analysis.category === "ethnic" && isTraditionalEthnicFootwear(product)) {
    return {
      score: 26,
      exact: false,
      traditional: true,
    };
  }

  if (analysis.category === "ethnic" && ETHNIC_SECONDARY_TYPES.includes(product.type)) {
    return {
      score: product.type === "loafers" ? 24 : 14,
      exact: false,
      traditional: false,
    };
  }

  if ((OUTFIT_TYPE_HINTS[analysis.category] || []).includes(product.type)) {
    return {
      score: 16,
      exact: false,
      traditional: false,
    };
  }

  return {
    score: 0,
    exact: false,
    traditional: false,
  };
};

const isOutfitTypeStrictlyBlocked = (product, analysis) => {
  if (analysis.category !== "ethnic") {
    return false;
  }

  return (
    !analysis.allowedTypes.includes(product.type) &&
    !ETHNIC_SECONDARY_TYPES.includes(product.type) &&
    !isTraditionalEthnicFootwear(product)
  );
};

const getOutfitColorFit = (productColors = [], analysis) => {
  if (!productColors.length) {
    return {
      score: 0,
      color: "",
      mode: "none",
    };
  }

  if (analysis.dominantColor && productColors.includes(analysis.dominantColor)) {
    return {
      score: 20,
      color: analysis.dominantColor,
      mode: "dominant",
    };
  }

  const paletteMatch = analysis.palette.find((entry) => productColors.includes(entry.color));

  if (paletteMatch) {
    return {
      score: 16,
      color: paletteMatch.color,
      mode: "palette",
    };
  }

  const recommendedColorMatch = analysis.recommendedShoeColors.find((color) => productColors.includes(color));

  if (recommendedColorMatch) {
    return {
      score: 13,
      color: recommendedColorMatch,
      mode: "recommended",
    };
  }

  const compatibleColors = getCompatibleOutfitColors(
    analysis.dominantColor,
    analysis.palette.map((entry) => entry.color),
    analysis.category
  );
  const compatibleColorMatch = productColors.find((color) => compatibleColors.includes(color));

  if (compatibleColorMatch) {
    return {
      score: 10,
      color: compatibleColorMatch,
      mode: "compatible",
    };
  }

  const neutralColorMatch = productColors.find((color) => NEUTRAL_OUTFIT_COLORS.has(color));

  if (neutralColorMatch) {
    return {
      score: analysis.neutralShare < 0.55 ? 8 : 6,
      color: neutralColorMatch,
      mode: "neutral",
    };
  }

  return {
    score: 0,
    color: "",
    mode: "none",
  };
};

const buildOutfitProductReasons = (product, analysis, typeFit, colorFit) => {
  const reasons = [];

  if (product.category === analysis.category) {
    reasons.push(
      `${humanizeOutfitValue(product.category)} styling fits your ${humanizeOutfitValue(analysis.style)} look.`
    );
  } else if ((OUTFIT_CATEGORY_FALLBACKS[analysis.category] || []).includes(product.category)) {
    reasons.push(
      `${humanizeOutfitValue(product.category)} styling works as a flexible alternative for this outfit.`
    );
  }

  if (typeFit.exact) {
    reasons.push(
      `${humanizeOutfitValue(product.type)} is one of the best shoe types for ${humanizeOutfitValue(
        analysis.clothingType
      )}.`
    );
  } else if (typeFit.traditional) {
    reasons.push(
      `Traditional ethnic footwear like this pairs naturally with ${humanizeOutfitValue(analysis.clothingType)}.`
    );
  } else if (typeFit.score > 0) {
    reasons.push(
      `${humanizeOutfitValue(product.type)} keeps the outfit balanced without overpowering it.`
    );
  }

  if (colorFit.mode === "dominant") {
    reasons.push(`${humanizeOutfitValue(colorFit.color)} matches the dominant outfit color directly.`);
  } else if (colorFit.mode === "palette") {
    reasons.push(`${humanizeOutfitValue(colorFit.color)} echoes one of the key outfit palette colors.`);
  } else if (colorFit.mode === "recommended") {
    reasons.push(
      `${humanizeOutfitValue(colorFit.color)} is a safe shoe color recommendation for this palette.`
    );
  } else if (colorFit.mode === "compatible") {
    reasons.push(
      `${humanizeOutfitValue(colorFit.color)} adds a balanced contrast to your outfit colors.`
    );
  } else if (colorFit.mode === "neutral") {
    reasons.push(`${humanizeOutfitValue(colorFit.color)} keeps the shoe choice versatile for the outfit.`);
  }

  if (product.isTrending) {
    reasons.push("This pair is trending in the catalog right now.");
  }

  return uniqueValues(reasons).slice(0, 3);
};

const scoreOutfitProduct = (product, analysis) => {
  if (product.category !== analysis.category) {
    return {
      score: 0,
      matchPercentage: 0,
      isAlternative: true,
      matchSummary: "Outside the best-fit category for this outfit.",
      matchReasons: [],
    };
  }

  if (!analysis.allowedTypes.includes(product.type)) {
    return {
      score: 0,
      matchPercentage: 0,
      isAlternative: true,
      matchSummary: "Excluded because this shoe type is not allowed for the detected outfit category.",
      matchReasons: [],
    };
  }

  const productColors = getProductColors(product);
  const hasExactColorMatch = Boolean(analysis.dominantColor) && productColors.includes(analysis.dominantColor);
  const score = 60 + (hasExactColorMatch ? 20 : 0);
  const matchReasons = [
    `${humanizeOutfitValue(product.category)} styling matches your ${humanizeOutfitValue(analysis.category)} category.`,
    `${humanizeOutfitValue(product.type)} is one of the approved shoe types for ${humanizeOutfitValue(
      analysis.clothingType
    )}.`,
  ];

  if (hasExactColorMatch) {
    matchReasons.push(`${humanizeOutfitValue(analysis.dominantColor)} matches the detected outfit color directly.`);
  }

  return {
    score,
    matchPercentage: hasExactColorMatch ? 96 : 84,
    isAlternative: false,
    matchSummary: matchReasons[0] || "Solid catalog match for your outfit.",
    matchReasons: uniqueValues(matchReasons).slice(0, 3),
  };
};

const buildAlternativeOutfitProduct = (product, analysis) =>
  serializeRecommendationProduct(product, {
    matchScore: 0,
    matchPercentage: 0,
    isAlternative: true,
    matchSummary: `Closest ${humanizeOutfitValue(product.category)} option while we refine the match.`,
    matchReasons: [
      `${humanizeOutfitValue(product.category)} styling is the nearest catalog fallback for this ${humanizeOutfitValue(
        analysis.style
      )} outfit.`,
    ],
  });

const getChatSessionKey = (req) => {
  if (req.user?._id) {
    return `user:${req.user._id.toString()}`;
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  const ip =
    typeof forwardedFor === "string"
      ? forwardedFor.split(",")[0].trim()
      : req.ip || req.socket?.remoteAddress || "anonymous";

  return `guest:${ip}:${req.get("user-agent") || "unknown"}`;
};

const getChatSession = (sessionKey) => {
  const existingSession = chatbotSessions.get(sessionKey);

  if (existingSession && Date.now() - existingSession.updatedAt < ORDER_CONTEXT_TTL_MS) {
    return existingSession;
  }

  if (existingSession) {
    chatbotSessions.delete(sessionKey);
  }

  return {
    awaitingOrderId: false,
    lastIntent: null,
    updatedAt: Date.now(),
  };
};

const updateChatSession = (sessionKey, updates) => {
  const nextSession = {
    ...getChatSession(sessionKey),
    ...updates,
    updatedAt: Date.now(),
  };

  chatbotSessions.set(sessionKey, nextSession);
  return nextSession;
};

const resetChatSession = (sessionKey) => {
  chatbotSessions.delete(sessionKey);
};

const extractOrderId = (message = "") => {
  const match = message.toUpperCase().match(ORDER_ID_REGEX);
  return match ? match[0] : null;
};

const isOrderTrackingRequest = (message = "") => {
  const normalizedMessage = message.toLowerCase();
  return ORDER_TRACKING_KEYWORD_REGEX.test(normalizedMessage) && /\border\b/i.test(normalizedMessage);
};

const detectLocalIntent = (message = "") => {
  if (isOrderTrackingRequest(message)) {
    return "order_tracking";
  }

  if (PRODUCT_SEARCH_KEYWORD_REGEX.test(message)) {
    return "product_search";
  }

  if (GREETING_KEYWORD_REGEX.test(message)) {
    return "greeting";
  }

  if (HELP_KEYWORD_REGEX.test(message)) {
    return "help";
  }

  return "unknown";
};

const normalizeIntent = (rawIntent, message = "") => {
  const forcedIntent = detectLocalIntent(message);

  if (forcedIntent !== "unknown") {
    return forcedIntent;
  }

  const normalizedIntent = String(rawIntent || "").trim().toLowerCase();

  if (["product_search", "product", "recommendation", "recommend", "search"].includes(normalizedIntent)) {
    return "product_search";
  }

  if (["order_tracking", "order_status", "track_order"].includes(normalizedIntent)) {
    return "order_tracking";
  }

  if (["greeting", "greet", "hello"].includes(normalizedIntent)) {
    return "greeting";
  }

  if (["help", "support"].includes(normalizedIntent)) {
    return "help";
  }

  if (normalizedIntent === "unknown") {
    return "unknown";
  }

  return forcedIntent;
};

const buildDefaultChatResponse = (intent) => {
  switch (intent) {
    case "greeting":
      return "Hello! How can I help you?";
    case "help":
      return "I can help you find shoes, suggest styles, or track an order. Ask for shoe suggestions anytime.";
    case "order_tracking":
      return "Please provide your order ID so I can track it for you.";
    case "product_search":
      return "Tell me what kind of shoes you want, and I will suggest a few options.";
    default:
      return "I'm here to help with shoe suggestions or order tracking.";
  }
};

const createStylistSessionData = (data = {}) => ({
  occasion: data.occasion || null,
  color: data.color || null,
  budget: data.budget || null,
});

const getNextStylistStep = ({ occasion, color, budget }) => {
  if (occasion === null) {
    return "ask_occasion";
  }

  if (color === null) {
    return "ask_color";
  }

  if (budget === null) {
    return "ask_budget";
  }

  return "recommend";
};

const getStylistSession = (sessionKey) => sessions[sessionKey] || null;

const startStylistSession = (sessionKey, data = {}) => {
  const sessionData = createStylistSessionData(data);

  sessions[sessionKey] = {
    step: getNextStylistStep(sessionData),
    data: sessionData,
  };

  return sessions[sessionKey];
};

const resetStylistSession = (sessionKey) => {
  delete sessions[sessionKey];
};

const shouldStartStylistFlow = (message = "") => STYLIST_START_REGEX.test(message.toLowerCase());

const isSkipAnswer = (message = "") => STYLIST_SKIP_REGEX.test(message.toLowerCase());

const normalizeOccasionAnswer = (message = "") => {
  const normalizedMessage = message.toLowerCase();

  if (isSkipAnswer(normalizedMessage)) {
    return null;
  }

  if (/\bparty\b/.test(normalizedMessage)) {
    return "party";
  }

  if (/\b(gym|workout|training|exercise|fitness)\b/.test(normalizedMessage)) {
    return "gym";
  }

  if (/\b(run|running|jog|jogging|marathon)\b/.test(normalizedMessage)) {
    return "running";
  }

  if (/\b(office|work|formal|business)\b/.test(normalizedMessage)) {
    return "office";
  }

  if (/\b(daily|everyday|casual|regular)\b/.test(normalizedMessage)) {
    return "daily";
  }

  if (/\b(wedding|marriage|ceremony|ethnic|traditional|festive)\b/.test(normalizedMessage)) {
    return "wedding";
  }

  if (/\b(travel|trip|vacation|holiday|outdoor|hiking|trek|trekking)\b/.test(normalizedMessage)) {
    return "travel";
  }

  return null;
};

const normalizeColorAnswer = (message = "") => {
  const normalizedMessage = message.toLowerCase().trim();

  if (!normalizedMessage || isSkipAnswer(normalizedMessage) || /\b(none|no)\b/.test(normalizedMessage)) {
    return null;
  }

  const matchedColor = KNOWN_STYLIST_COLORS.find((color) => normalizedMessage.includes(color));

  if (!matchedColor) {
    return null;
  }

  return matchedColor === "gray" ? "grey" : matchedColor;
};

const normalizeBudgetAnswer = (message = "") => {
  const normalizedMessage = message.toLowerCase();

  if (isSkipAnswer(normalizedMessage) || /\b(no budget|flexible)\b/.test(normalizedMessage)) {
    return null;
  }

  const numericValue = Number(message.replace(/[^\d.]/g, ""));

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return numericValue;
};

const extractStylistPreferences = (message = "") => ({
  occasion: normalizeOccasionAnswer(message),
  color: normalizeColorAnswer(message),
  budget: normalizeBudgetAnswer(message),
});

const hasAllStylistPreferences = (preferences) =>
  preferences.occasion !== null && preferences.color !== null && preferences.budget !== null;

const getStylistPrompt = (step) => STYLIST_STEP_PROMPTS[step] || STYLIST_STEP_PROMPTS.ask_occasion;

const buildStylistFilters = ({ occasion, color, budget }) => {
  const exactFilter = {};
  const categoryFallbackFilter = {};
  const mappedOccasion = occasion ? STYLIST_OCCASION_FILTERS[occasion] : null;

  if (mappedOccasion?.category) {
    const categories = Array.isArray(mappedOccasion.category) ? mappedOccasion.category : [mappedOccasion.category];
    const categoryFilter = { $in: categories };
    exactFilter.category = categoryFilter;
    categoryFallbackFilter.category = categoryFilter;
  }

  if (mappedOccasion?.type) {
    const types = Array.isArray(mappedOccasion.type) ? mappedOccasion.type : [mappedOccasion.type];
    exactFilter.type = { $in: types };
  }

  if (color) {
    const colorFilter = { $in: [color.toLowerCase()] };
    exactFilter.colors = colorFilter;
    categoryFallbackFilter.colors = colorFilter;
  }

  if (budget) {
    const budgetFilter = { $lte: budget };
    exactFilter.price = budgetFilter;
    categoryFallbackFilter.price = budgetFilter;
  }

  return { exactFilter, categoryFallbackFilter };
};

const findStylistProducts = async (preferences, limit = 5) => {
  const { exactFilter, categoryFallbackFilter } = buildStylistFilters(preferences);
  const exactMatches = await Product.find(exactFilter)
    .select("-reviews")
    .sort({ isTrending: -1, stock: -1, createdAt: -1 })
    .limit(limit);

  if (exactMatches.length >= limit || !categoryFallbackFilter.category || !exactFilter.type) {
    return exactMatches;
  }

  const fallbackMatches = await Product.find({
    ...categoryFallbackFilter,
    _id: { $nin: exactMatches.map((product) => product._id) },
  })
    .select("-reviews")
    .sort({ isTrending: -1, stock: -1, createdAt: -1 })
    .limit(limit - exactMatches.length);

  return [...exactMatches, ...fallbackMatches];
};

const buildStylistRecommendation = async (preferences) => {
  const products = await findStylistProducts(preferences, 5);

  return {
    intent: "product_search",
    response: products.length
      ? "Here are perfect shoes based on your preference."
      : "I couldn't find a perfect match for those preferences right now. Try another color or budget.",
    products,
  };
};

const getStylistStepResponse = async (sessionKey, message) => {
  const stylistSession = getStylistSession(sessionKey);

  if (!stylistSession) {
    return null;
  }

  const extracted = extractStylistPreferences(message);
  const skipAnswer = isSkipAnswer(message);

  if (stylistSession.step === "ask_occasion") {
    if (extracted.occasion === null && !skipAnswer) {
      return {
        intent: "product_search",
        response: getStylistPrompt("ask_occasion"),
        products: [],
      };
    }

    stylistSession.data.occasion = extracted.occasion;
  }

  if (stylistSession.step === "ask_color") {
    if (extracted.color === null && !skipAnswer) {
      return {
        intent: "product_search",
        response: getStylistPrompt("ask_color"),
        products: [],
      };
    }

    stylistSession.data.color = extracted.color;
  }

  if (stylistSession.step === "ask_budget") {
    if (extracted.budget === null && !skipAnswer) {
      return {
        intent: "product_search",
        response: "What's your budget? Please share a number like 3000.",
        products: [],
      };
    }

    stylistSession.data.budget = extracted.budget;
  }

  stylistSession.step = getNextStylistStep(stylistSession.data);

  if (stylistSession.step === "recommend") {
    const recommendation = await buildStylistRecommendation(stylistSession.data);
    resetStylistSession(sessionKey);
    return recommendation;
  }

  return {
    intent: "product_search",
    response: getStylistPrompt(stylistSession.step),
    products: [],
  };
};

const findOrderForChat = async (orderId, userId) => {
  const normalizedOrderId = orderId.toUpperCase();
  const query = {
    orderNumber: normalizedOrderId,
  };

  if (userId) {
    query.userId = userId;
  }

  return Order.findOne(query);
};

const buildOrderStatusResponse = (order) => {
  const normalizedStatus = order.orderStatus.toLowerCase();
  const statusMessages = {
    processing: `Your order ${order.orderNumber} is currently being prepared.`,
    shipped: `Your order ${order.orderNumber} is currently on the way and will arrive soon.`,
    completed: `Your order ${order.orderNumber} was delivered successfully.`,
    cancelled: `Your order ${order.orderNumber} has been cancelled.`,
  };

  return statusMessages[normalizedStatus] || `Your order ${order.orderNumber} is currently ${normalizedStatus}.`;
};

const saveChatQuery = (userId, message, response) =>
  ChatQuery.create({
    userId: userId || null,
    message,
    response,
  });

const logPythonServiceError = (label, error) => {
  console.error(`${label} failed: ${error?.message || error}`);
  console.log(`${label} response data:`, error?.response?.data);
  console.log(`${label} status:`, error?.response?.status);
  console.log(`${label} code:`, error?.code);
};

const fetchPythonChatResponse = async (message) => {
  const { data } = await axios.post(
    getAiServiceUrl("/chat"),
    { message },
    {
      timeout: 8000,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return data;
};

const fetchPythonOutfitPrediction = async (file) => {
  const imageBuffer = await getUploadedImageBuffer(file);
  const form = new FormData();
  form.append("image", imageBuffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  const axiosConfig = {
    timeout: 10000,
    headers: {
      ...form.getHeaders(),
      Accept: "application/json",
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  };

  try {
    console.log("Calling Python API...");
    const response = await axios.post(getAiServiceUrl("/predict-outfit"), form, axiosConfig);
    console.log("Python response:", response.data);

    if (!response.data?.style || !response.data?.color || !response.data?.category) {
      throw new Error("Python AI service returned an incomplete outfit prediction.");
    }

    return response.data;
  } catch (error) {
    logPythonServiceError("Python outfit service", error);
    throw error;
  }
};

const fetchProductsByFilters = async (filter = {}, limit = 5, excludeIds = []) =>
  Product.find({
    ...filter,
    _id: { $nin: excludeIds },
  })
    .sort({ isTrending: -1, stock: -1, createdAt: -1 })
    .limit(limit);

const findProductsFromOutfitPrediction = async (
  prediction = {},
  limit = 5
) => {
  const analysis = buildOutfitAnalysis(prediction);
  let products = await Product.find({
    category: analysis.category,
  })
    .select("-reviews")
    .sort({ isTrending: -1, stock: -1, createdAt: -1 })
    .limit(40);

  products = products.filter((product) => hasLowercaseProductTaxonomy(product));
  products = products.filter((product) => analysis.allowedTypes.includes(product.type));

  const scoredProducts = products
    .map((product) => ({
      product,
      ...scoreOutfitProduct(product, analysis),
    }))
    .filter((entry) => entry.score >= 60)
    .sort((left, right) => {
      const scoreDifference = right.score - left.score;
      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const trendingDifference = Number(right.product.isTrending) - Number(left.product.isTrending);
      if (trendingDifference !== 0) {
        return trendingDifference;
      }

      const stockDifference = (right.product.stock || 0) - (left.product.stock || 0);
      if (stockDifference !== 0) {
        return stockDifference;
      }

      return (
        new Date(right.product.createdAt || 0).getTime() - new Date(left.product.createdAt || 0).getTime()
      );
    });

  if (!scoredProducts.length) {
    let fallbackProducts = await Product.find({ category: analysis.category })
      .select("-reviews")
      .sort({ isTrending: -1, stock: -1, createdAt: -1 })
      .limit(limit);

    fallbackProducts = fallbackProducts.filter(
      (product) => hasLowercaseProductTaxonomy(product) && analysis.allowedTypes.includes(product.type)
    );

    return {
      analysis,
      products: fallbackProducts.map((product) => buildAlternativeOutfitProduct(product, analysis)),
      hasStrongMatches: false,
    };
  }

  const recommendedProducts = scoredProducts.slice(0, limit).map((entry) =>
    serializeRecommendationProduct(entry.product, {
      matchScore: entry.score,
      matchPercentage: entry.matchPercentage,
      isAlternative: entry.isAlternative,
      matchSummary: entry.matchSummary,
      matchReasons: entry.matchReasons,
    })
  );

  return {
    analysis,
    products: recommendedProducts,
    hasStrongMatches: recommendedProducts.some((product) => !product.isAlternative),
  };
};

const chatbot = asyncHandler(async (req, res) => {
  const message = req.body.message || req.body.query;

  if (!message) {
    res.status(400);
    throw new Error("message is required.");
  }

  const sessionKey = getChatSessionKey(req);
  const session = getChatSession(sessionKey);
  const orderId = extractOrderId(message);
  const orderTrackingRequest = isOrderTrackingRequest(message);
  const localIntent = detectLocalIntent(message);
  const stylistSession = getStylistSession(sessionKey);

  if (stylistSession) {
    if (orderId || orderTrackingRequest) {
      resetStylistSession(sessionKey);
    } else {
      const stylistResponse = await getStylistStepResponse(sessionKey, message);

      if (stylistResponse) {
        await saveChatQuery(req.user?._id, message, stylistResponse.response);
        await recordRecommendationEvents(stylistResponse.products, req.user?._id);

        return res.json({
          success: true,
          message:
            stylistResponse.products.length > 0
              ? "Chatbot recommendation generated successfully."
              : "Chatbot response generated successfully.",
          intent: stylistResponse.intent,
          response: stylistResponse.response,
          products: stylistResponse.products,
          fallback: false,
        });
      }
    }
  }

  if (shouldStartStylistFlow(message)) {
    resetChatSession(sessionKey);

    const extractedPreferences = extractStylistPreferences(message);

    if (hasAllStylistPreferences(extractedPreferences)) {
      const stylistResponse = await buildStylistRecommendation(extractedPreferences);

      await saveChatQuery(req.user?._id, message, stylistResponse.response);
      await recordRecommendationEvents(stylistResponse.products, req.user?._id);

      return res.json({
        success: true,
        message:
          stylistResponse.products.length > 0
            ? "Chatbot recommendation generated successfully."
            : "Chatbot response generated successfully.",
        intent: stylistResponse.intent,
        response: stylistResponse.response,
        products: stylistResponse.products,
        fallback: false,
      });
    }

    const nextStylistSession = startStylistSession(sessionKey, extractedPreferences);
    const responseText = getStylistPrompt(nextStylistSession.step);

    await saveChatQuery(req.user?._id, message, responseText);

    return res.json({
      success: true,
      message: "Chatbot response generated successfully.",
      intent: "product_search",
      response: responseText,
      products: [],
      fallback: false,
    });
  }

  if (orderId) {
    const order = await findOrderForChat(orderId, req.user?._id);
    const responseText = order
      ? buildOrderStatusResponse(order)
      : `I couldn't find an order with ID ${orderId}. Please check the order ID and try again.`;

    if (order) {
      resetChatSession(sessionKey);
    } else {
      updateChatSession(sessionKey, {
        awaitingOrderId: true,
        lastIntent: "order_tracking",
      });
    }

    await saveChatQuery(req.user?._id, message, responseText);

    return res.json({
      success: true,
      message: "Chatbot response generated successfully.",
      intent: "order_tracking",
      response: responseText,
      products: [],
      fallback: false,
    });
  }

  if (session.awaitingOrderId) {
    if (!orderTrackingRequest && !orderId && localIntent !== "unknown") {
      resetChatSession(sessionKey);
    } else {
      const responseText = "Please provide your order ID in the format ORD-SEED-010 so I can track it for you.";

      updateChatSession(sessionKey, {
        awaitingOrderId: true,
        lastIntent: "order_tracking",
      });

      await saveChatQuery(req.user?._id, message, responseText);

      return res.json({
        success: true,
        message: "Chatbot response generated successfully.",
        intent: "order_tracking",
        response: responseText,
        products: [],
        fallback: false,
      });
    }
  }

  if (orderTrackingRequest) {
    const responseText = "Please provide your order ID so I can track it for you.";

    updateChatSession(sessionKey, {
      awaitingOrderId: true,
      lastIntent: "order_tracking",
    });

    await saveChatQuery(req.user?._id, message, responseText);

    return res.json({
      success: true,
      message: "Chatbot response generated successfully.",
      intent: "order_tracking",
      response: responseText,
      products: [],
      fallback: false,
    });
  }

  let intent = localIntent;
  let responseText = buildDefaultChatResponse(intent);
  let usedFallback = false;
  let recommendedProducts = [];

  try {
    const aiResponse = await fetchPythonChatResponse(message);
    intent = normalizeIntent(aiResponse.intent, message);
    responseText = aiResponse.response || buildDefaultChatResponse(intent);
  } catch (error) {
    usedFallback = true;
    intent = normalizeIntent(intent, message);
    responseText = buildDefaultChatResponse(intent);
    console.error(`Python chat service failed: ${error.message}`);
  }

  if (intent === "order_tracking") {
    updateChatSession(sessionKey, {
      awaitingOrderId: true,
      lastIntent: intent,
    });
    responseText = "Please provide your order ID so I can track it for you.";
  } else {
    resetChatSession(sessionKey);
  }

  if (intent === "product_search") {
    recommendedProducts = await findChatbotRecommendations(message, 6);

    if (!responseText || responseText === buildDefaultChatResponse(intent)) {
      responseText = recommendedProducts.length
        ? buildChatbotReply(message, recommendedProducts)
        : DEFAULT_PRODUCT_CHAT_FALLBACK;
    }

    if (usedFallback && !recommendedProducts.length) {
      responseText = DEFAULT_PRODUCT_CHAT_FALLBACK;
    }
  } else {
    recommendedProducts = [];

    if (usedFallback) {
      responseText = DEFAULT_GENERAL_CHAT_FALLBACK;
    }
  }

  await saveChatQuery(req.user?._id, message, responseText);

  const productsToReturn = intent === "product_search" ? recommendedProducts : [];

  await recordRecommendationEvents(productsToReturn, req.user?._id);

  res.json({
    success: true,
    message:
      intent === "product_search"
        ? "Chatbot recommendation generated successfully."
        : "Chatbot response generated successfully.",
    intent,
    response: responseText,
    products: productsToReturn,
    fallback: usedFallback,
  });
});

const outfitRecommendation = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("Image upload is required.");
  }

  let clothingType = "casual wear";
  let detectedColor = "";
  let rgb = null;
  let analysis = null;
  let recommendedProducts = [];
  let hasStrongMatches = true;
  let usedFallback = false;

  try {
    const aiResponse = await fetchPythonOutfitPrediction(req.file);
    let { category, color } = aiResponse;
    category = normalizeSemanticOutfitCategory(category);
    const outfitRecommendationResult = await findProductsFromOutfitPrediction({
      ...aiResponse,
      category,
      color,
      filename: req.file.originalname,
    });
    analysis = outfitRecommendationResult.analysis;
    clothingType = analysis.clothingType || aiResponse.clothingType || aiResponse.style || clothingType;
    detectedColor = analysis.dominantColor || aiResponse.dominantColor || aiResponse.color || detectedColor;
    rgb = analysis.rgb || aiResponse.rgb || null;
    recommendedProducts = outfitRecommendationResult.products;
    hasStrongMatches = outfitRecommendationResult.hasStrongMatches;
  } catch (error) {
    usedFallback = true;
    console.error(`Python outfit service failed: ${error.message}`);

    const fallbackColor = await detectDominantColor(await getUploadedImageBuffer(req.file));
    detectedColor = normalizeOutfitColor(fallbackColor.color);
    rgb = fallbackColor.rgb;
    const fallbackCategory = normalizeSemanticOutfitCategory(normalizeDetectedClothingType("", req.file.originalname));
    const fallbackStyle = getStrictOutfitStyle(fallbackCategory);
    const outfitRecommendationResult = await findProductsFromOutfitPrediction({
      style: fallbackStyle,
      clothingType: fallbackStyle,
      color: detectedColor,
      dominantColor: detectedColor,
      rgb,
      palette: detectedColor
        ? [
            {
              color: detectedColor,
              share: 1,
            },
          ]
        : [],
      category: fallbackCategory,
      filename: req.file.originalname,
      reasoning: [
        "The image service was unavailable, so we used dominant color and filename cues for the match.",
      ],
    });
    analysis = outfitRecommendationResult.analysis;
    clothingType = analysis.clothingType || fallbackStyle;
    detectedColor = analysis.dominantColor || detectedColor;
    rgb = analysis.rgb || rgb;
    recommendedProducts = outfitRecommendationResult.products;
    hasStrongMatches = outfitRecommendationResult.hasStrongMatches;
  } finally {
    cleanupUpload(req.file.path);
  }

  await recordRecommendationEvents(recommendedProducts, req.user?._id);

  res.json({
    success: true,
    message: hasStrongMatches
      ? "Outfit recommendation generated successfully."
      : "No strong match found. Showing closest alternatives.",
    clothingType,
    color: detectedColor,
    detectedColor,
    rgb,
    analysis,
    products: recommendedProducts,
    fallback: usedFallback,
  });
});

module.exports = {
  chatbot,
  outfitRecommendation,
};

