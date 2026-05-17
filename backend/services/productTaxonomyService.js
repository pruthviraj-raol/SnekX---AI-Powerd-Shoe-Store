const PRODUCT_CATEGORIES = ["casual", "formal", "sports", "outdoor", "ethnic"];
const PRODUCT_TYPES = [
  "running",
  "training",
  "lifestyle",
  "walking",
  "basketball",
  "football",
  "hiking",
  "loafers",
  "oxford",
  "derby",
  "sneakers",
  "slip-on",
  "sandals",
];
const PRODUCT_COLORS = ["black", "white", "red", "blue", "brown", "tan", "grey", "green", "orange", "yellow", "gold", "cream"];

const CATEGORY_ALIASES = {
  casual: "casual",
  lifestyle: "casual",
  informal: "casual",
  everyday: "casual",
  sneaker: "casual",
  sneakers: "casual",
  "slip on": "casual",
  "slip-on": "casual",
  sandal: "casual",
  sandals: "casual",
  formal: "formal",
  office: "formal",
  dress: "formal",
  premium: "formal",
  loafer: "formal",
  loafers: "formal",
  oxford: "formal",
  oxfords: "formal",
  derby: "formal",
  derbies: "formal",
  sports: "sports",
  sport: "sports",
  athletic: "sports",
  running: "sports",
  training: "sports",
  basketball: "sports",
  football: "sports",
  soccer: "sports",
  walking: "sports",
  outdoor: "outdoor",
  hiking: "outdoor",
  trail: "outdoor",
  trekking: "outdoor",
  ethnic: "ethnic",
  traditional: "ethnic",
  festive: "ethnic",
};

const TYPE_ALIASES = {
  running: "running",
  runner: "running",
  jogging: "running",
  race: "running",
  track: "running",
  performance: "running",
  training: "training",
  workout: "training",
  gym: "training",
  crossfit: "training",
  lifting: "training",
  lifestyle: "lifestyle",
  casual: "lifestyle",
  formal: "lifestyle",
  dress: "lifestyle",
  office: "lifestyle",
  streetwear: "lifestyle",
  everyday: "lifestyle",
  walking: "walking",
  walker: "walking",
  comfort: "walking",
  basketball: "basketball",
  court: "basketball",
  hoop: "basketball",
  football: "football",
  soccer: "football",
  cleats: "football",
  turf: "football",
  hiking: "hiking",
  trail: "hiking",
  trekking: "hiking",
  outdoor: "hiking",
  loafer: "loafers",
  loafers: "loafers",
  oxford: "oxford",
  oxfords: "oxford",
  derby: "derby",
  derbies: "derby",
  sneaker: "sneakers",
  sneakers: "sneakers",
  trainer: "sneakers",
  trainers: "sneakers",
  "slip on": "slip-on",
  "slip-on": "slip-on",
  slipon: "slip-on",
  sandal: "sandals",
  sandals: "sandals",
  slide: "sandals",
  slides: "sandals",
};

const DEFAULT_COLORS_BY_CATEGORY = {
  casual: ["black", "white"],
  formal: ["black", "brown", "tan"],
  sports: ["red", "blue"],
  outdoor: ["brown", "tan", "black"],
  ethnic: ["tan", "brown", "red"],
};

const DEFAULT_COLORS_BY_TYPE = {
  running: ["blue", "white"],
  training: ["red", "black"],
  lifestyle: ["black", "white", "brown"],
  walking: ["black", "white"],
  basketball: ["red", "blue"],
  football: ["blue", "black"],
  hiking: ["brown", "tan"],
  loafers: ["brown", "tan"],
  oxford: ["black", "brown"],
  derby: ["brown", "black"],
  sneakers: ["black", "white", "blue"],
  "slip-on": ["black", "tan"],
  sandals: ["tan", "brown"],
};

const normalizeToken = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .replace(/\s*-\s*/g, "-");

const uniqueValues = (values) => [...new Set(values.filter(Boolean))];

const normalizeProductCategory = (value = "") => CATEGORY_ALIASES[normalizeToken(value)] || "";

const normalizeProductType = (value = "") => TYPE_ALIASES[normalizeToken(value)] || "";

const extractKeywordText = ({ name = "", description = "", tags = [] }) =>
  [name, description, ...(Array.isArray(tags) ? tags : [])].join(" ").toLowerCase();

const inferProductType = (product = {}) => {
  const explicitType = normalizeProductType(product.type);

  if (explicitType) {
    return explicitType;
  }

  const rawCategory = normalizeToken(product.category);
  const categoryAsType = normalizeProductType(rawCategory);
  if (categoryAsType) {
    return categoryAsType;
  }

  if (rawCategory === "sports") {
    return "running";
  }
  if (rawCategory === "outdoor") {
    return "hiking";
  }
  if (rawCategory === "casual" || rawCategory === "formal" || rawCategory === "ethnic") {
    return "lifestyle";
  }

  const keywordText = extractKeywordText(product);

  if (/(training|gym|workout|crossfit|lift)/i.test(keywordText)) {
    return "training";
  }
  if (/(basketball|court|hoop)/i.test(keywordText)) {
    return "basketball";
  }
  if (/(football|soccer|cleat|turf|stud)/i.test(keywordText)) {
    return "football";
  }
  if (/(hiking|trail|trek|outdoor)/i.test(keywordText)) {
    return "hiking";
  }
  if (/(running|runner|jogging|race|track|sport)/i.test(keywordText)) {
    return "running";
  }
  if (/(walking|walker|comfort)/i.test(keywordText)) {
    return "walking";
  }
  if (/\boxfords?\b/i.test(keywordText)) {
    return "oxford";
  }
  if (/\bderb(?:y|ies)\b/i.test(keywordText)) {
    return "derby";
  }
  if (/\bloafer(s)?\b/i.test(keywordText)) {
    return "loafers";
  }
  if (/\bsneaker(s)?\b/i.test(keywordText)) {
    return "sneakers";
  }
  if (/\bslip[- ]?on(s)?\b/i.test(keywordText)) {
    return "slip-on";
  }
  if (/\bsandal(s)?\b|\bslide(s)?\b/i.test(keywordText)) {
    return "sandals";
  }

  return "lifestyle";
};

const inferProductCategory = (product = {}) => {
  const explicitCategory = normalizeProductCategory(product.category);

  if (explicitCategory) {
    return explicitCategory;
  }

  const explicitType = inferProductType(product);
  if (["running", "training", "walking", "basketball", "football"].includes(explicitType)) {
    return "sports";
  }
  if (explicitType === "hiking") {
    return "outdoor";
  }
  if (["loafers", "oxford", "derby"].includes(explicitType)) {
    return "formal";
  }
  if (["sneakers", "slip-on", "sandals"].includes(explicitType)) {
    return "casual";
  }

  const keywordText = extractKeywordText(product);
  if (/(ethnic|traditional|festive|jutti|kolhapuri|mojari)/i.test(keywordText)) {
    return "ethnic";
  }
  if (/(hiking|trail|trek|outdoor)/i.test(keywordText)) {
    return "outdoor";
  }
  if (/(formal|office|dress|premium|tailored|loafer|oxford|derby)/i.test(keywordText)) {
    return "formal";
  }
  if (/(running|training|gym|sport|basketball|football|soccer|court|track|walking)/i.test(keywordText)) {
    return "sports";
  }

  return "casual";
};

const normalizeProductColors = (product = {}) => {
  const rawColors = Array.isArray(product.colors) ? product.colors : [];
  const normalizedColors = uniqueValues(
    [product.color, ...rawColors]
      .map(normalizeToken)
      .filter((color) => PRODUCT_COLORS.includes(color))
  );

  const category = inferProductCategory(product);
  const type = inferProductType(product);
  const fallbackPalette = uniqueValues([
    ...(DEFAULT_COLORS_BY_TYPE[type] || []),
    ...(DEFAULT_COLORS_BY_CATEGORY[category] || []),
  ]);

  const finalColors = [...normalizedColors];

  for (const fallbackColor of fallbackPalette) {
    if (finalColors.length >= 2) {
      break;
    }

    if (!finalColors.includes(fallbackColor)) {
      finalColors.push(fallbackColor);
    }
  }

  while (finalColors.length < 2) {
    finalColors.push(PRODUCT_COLORS[finalColors.length]);
  }

  return uniqueValues(finalColors).slice(0, 4);
};

const normalizeProductAttributes = (product = {}) => {
  const type = inferProductType(product);
  const category = inferProductCategory({ ...product, type });
  const colors = normalizeProductColors({ ...product, category, type });

  return {
    category,
    type,
    color: colors[0],
    colors,
  };
};

module.exports = {
  PRODUCT_CATEGORIES,
  PRODUCT_TYPES,
  PRODUCT_COLORS,
  normalizeProductCategory,
  normalizeProductType,
  normalizeProductAttributes,
};
