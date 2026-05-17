const Product = require("../models/Product");
const SearchLog = require("../models/SearchLog");
const asyncHandler = require("../middleware/asyncHandler");
const {
  normalizeProductAttributes,
  normalizeProductCategory,
  normalizeProductType,
} = require("../services/productTaxonomyService");
const {
  parseArrayField,
  parseNumberField,
  parseBooleanField,
  getUploadedImagePaths,
} = require("../services/requestParserService");
const { importRemoteImageMap } = require("../services/remoteImageService");

const SEARCH_LOG_DEDUP_WINDOW_MS = 60 * 1000;
const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const calculateAverageRating = (reviews = []) =>
  reviews.length
    ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1))
    : 0;

const dedupeList = (values = []) => Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));

const buildProductPayload = async (req, { partial = false } = {}) => {
  const uploadedImages = getUploadedImagePaths(req);
  const imagesFromBody = parseArrayField(req.body.images);
  const rawPrimaryImage = typeof req.body.image === "string" ? req.body.image.trim() : "";
  const rawImageList = uploadedImages.length ? uploadedImages : imagesFromBody.length ? imagesFromBody : rawPrimaryImage ? [rawPrimaryImage] : [];
  const importedImageMap = uploadedImages.length ? new Map() : await importRemoteImageMap([rawPrimaryImage, ...rawImageList]);
  const normalizedPrimaryImage = uploadedImages.length
    ? rawImageList[0] || ""
    : rawPrimaryImage
      ? importedImageMap.get(rawPrimaryImage) || rawPrimaryImage
      : "";
  const normalizedImageList = uploadedImages.length
    ? rawImageList
    : rawImageList.map((image) => importedImageMap.get(String(image || "").trim()) || String(image || "").trim());
  const imageList = dedupeList([normalizedPrimaryImage, ...normalizedImageList]);
  const colors = parseArrayField(req.body.colors);
  const color = req.body.color || colors[0] || "";
  const payload = {};

  const include = (key) => !partial || req.body[key] !== undefined;

  if (include("name")) payload.name = req.body.name;
  if (include("brand")) payload.brand = req.body.brand;
  if (include("category")) payload.category = req.body.category;
  if (include("type")) payload.type = req.body.type;
  if (include("description")) payload.description = req.body.description;
  if (include("price")) payload.price = parseNumberField(req.body.price, 0);

  if (include("originalPrice")) {
    payload.originalPrice =
      req.body.originalPrice === undefined || req.body.originalPrice === ""
        ? null
        : parseNumberField(req.body.originalPrice, null);
  }

  if (include("sizes")) {
    payload.sizes = parseArrayField(req.body.sizes).map((size) => Number(size)).filter(Number.isFinite);
  }

  if (include("color") || include("colors")) {
    payload.color = color;
    payload.colors = colors.length ? colors : color ? [color] : [];
  }

  if (include("stock")) payload.stock = parseNumberField(req.body.stock, 0);

  if (include("image") || include("images") || uploadedImages.length) {
    payload.image = normalizedPrimaryImage || imageList[0] || "";
    payload.images = imageList;
  }

  if (include("rating")) payload.rating = parseNumberField(req.body.rating, 0);
  if (include("numReviews")) payload.numReviews = parseNumberField(req.body.numReviews, 0);
  if (include("reviews") && !Array.isArray(req.body.reviews)) {
    payload.numReviews = parseNumberField(req.body.reviews, payload.numReviews ?? 0);
  }
  if (include("tags")) payload.tags = parseArrayField(req.body.tags);
  if (include("isNew")) payload.isNew = parseBooleanField(req.body.isNew, false);
  if (include("isTrending")) payload.isTrending = parseBooleanField(req.body.isTrending, false);

  return payload;
};

const getProducts = asyncHandler(async (req, res) => {
  const { category, type, search, minPrice, maxPrice, brand, color, sort = "latest" } = req.query;
  const filter = {};
  const andConditions = [];
  const searchTerm = typeof search === "string" ? search.trim() : "";
  const normalizedCategory = typeof category === "string" ? normalizeProductCategory(category) : "";
  const normalizedType = typeof type === "string" ? normalizeProductType(type) : "";

  if (normalizedCategory) {
    andConditions.push({ category: new RegExp(`^${escapeRegex(normalizedCategory)}$`, "i") });
  }

  if (normalizedType) {
    andConditions.push({ type: new RegExp(`^${escapeRegex(normalizedType)}$`, "i") });
  }

  if (brand) {
    andConditions.push({ brand: new RegExp(brand, "i") });
  }

  if (color) {
    const regex = new RegExp(`^${escapeRegex(String(color).trim().toLowerCase())}$`, "i");
    andConditions.push({ $or: [{ color: regex }, { colors: regex }] });
  }

  if (minPrice || maxPrice) {
    const priceFilter = {};
    if (minPrice) priceFilter.$gte = Number(minPrice);
    if (maxPrice) priceFilter.$lte = Number(maxPrice);
    andConditions.push({ price: priceFilter });
  }

  if (searchTerm) {
    const searchRegex = new RegExp(searchTerm, "i");
    andConditions.push({ $or: [{ name: searchRegex }, { brand: searchRegex }, { category: searchRegex }, { type: searchRegex }] });

    const recentSearchWindow = new Date(Date.now() - SEARCH_LOG_DEDUP_WINDOW_MS);
    const normalizedTerm = searchTerm.toLowerCase();
    const recentSearch = await SearchLog.findOne({
      userId: req.user?._id || null,
      term: normalizedTerm,
      createdAt: { $gte: recentSearchWindow },
    }).select("_id");

    if (!recentSearch) {
      await SearchLog.create({
        userId: req.user?._id || null,
        term: normalizedTerm,
      });
    }
  }

  if (andConditions.length) {
    filter.$and = andConditions;
  }

  const sortOptions = {
    latest: { createdAt: -1 },
    priceAsc: { price: 1 },
    priceDesc: { price: -1 },
    popular: { numReviews: -1, rating: -1 },
    rating: { rating: -1 },
  };

  const products = await Product.find(filter).select("-reviews").sort(sortOptions[sort] || sortOptions.latest);

  res.json({
    success: true,
    count: products.length,
    products,
  });
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found.");
  }

  res.json({
    success: true,
    product,
  });
});

const createProduct = asyncHandler(async (req, res) => {
  const payload = await buildProductPayload(req);
  const normalizedPayload = {
    ...payload,
    ...normalizeProductAttributes(payload),
  };

  if (!normalizedPayload.name || !normalizedPayload.brand || !normalizedPayload.category || !normalizedPayload.description) {
    res.status(400);
    throw new Error("Name, brand, category, and description are required.");
  }

  const product = await Product.create(normalizedPayload);

  res.status(201).json({
    success: true,
    message: "Product created successfully.",
    product,
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  const existingProduct = await Product.findById(req.params.id);

  if (!existingProduct) {
    res.status(404);
    throw new Error("Product not found.");
  }

  const payload = await buildProductPayload(req, { partial: true });
  const mergedProduct = {
    ...existingProduct.toObject(),
    ...payload,
    images: payload.images ? (payload.images.length ? payload.images : existingProduct.images) : existingProduct.images,
    image: payload.image !== undefined ? payload.image || existingProduct.image : existingProduct.image,
    colors: payload.colors ? (payload.colors.length ? payload.colors : existingProduct.colors) : existingProduct.colors,
    color: payload.color !== undefined ? payload.color || existingProduct.color : existingProduct.color,
    tags: payload.tags ? (payload.tags.length ? payload.tags : existingProduct.tags) : existingProduct.tags,
    sizes: payload.sizes ? (payload.sizes.length ? payload.sizes : existingProduct.sizes) : existingProduct.sizes,
  };
  const normalizedTaxonomy = normalizeProductAttributes(mergedProduct);

  Object.assign(existingProduct, {
    ...payload,
    images: mergedProduct.images,
    image: mergedProduct.image,
    colors: normalizedTaxonomy.colors,
    color: normalizedTaxonomy.color,
    category: normalizedTaxonomy.category,
    type: normalizedTaxonomy.type,
    tags: mergedProduct.tags,
    sizes: mergedProduct.sizes,
  });

  const updatedProduct = await existingProduct.save();

  res.json({
    success: true,
    message: "Product updated successfully.",
    product: updatedProduct,
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found.");
  }

  await product.deleteOne();

  res.json({
    success: true,
    message: "Product deleted successfully.",
  });
});

const createProductReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const parsedRating = Number(rating);
  const trimmedComment = String(comment || "").trim();
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found.");
  }

  if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    res.status(400);
    throw new Error("Rating must be between 1 and 5.");
  }

  if (!trimmedComment) {
    res.status(400);
    throw new Error("Comment is required.");
  }

  const nextReviews = Array.isArray(product.reviews) ? [...product.reviews] : [];
  const existingReviewIndex = nextReviews.findIndex((review) => String(review.user) === String(req.user._id));
  const reviewPayload = {
    user: req.user._id,
    name: req.user.name,
    rating: parsedRating,
    comment: trimmedComment,
    createdAt: new Date(),
  };

  if (existingReviewIndex >= 0) {
    nextReviews[existingReviewIndex] = reviewPayload;
  } else {
    nextReviews.push(reviewPayload);
  }

  product.reviews = nextReviews;
  product.numReviews = nextReviews.length;
  product.rating = calculateAverageRating(nextReviews);

  await product.save();

  res.json({
    success: true,
    message: "Review added successfully",
  });
});

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
};

