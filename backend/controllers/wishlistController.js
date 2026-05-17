const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");
const asyncHandler = require("../middleware/asyncHandler");

const getWishlist = async (userId) => {
  const wishlist = await Wishlist.find({ userId })
    .populate("productId")
    .sort({ createdAt: -1 });

  const orphanedItemIds = wishlist.filter((item) => !item.productId).map((item) => item._id);

  if (orphanedItemIds.length) {
    await Wishlist.deleteMany({ _id: { $in: orphanedItemIds } });
  }

  return wishlist.filter((item) => item.productId);
};

const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    res.status(400);
    throw new Error("productId is required.");
  }

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found.");
  }

  await Wishlist.findOneAndUpdate(
    { userId: req.user._id, productId },
    { userId: req.user._id, productId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const wishlist = await getWishlist(req.user._id);

  res.status(201).json({
    success: true,
    message: "Item added to wishlist.",
    wishlist,
  });
});

const getWishlistItems = asyncHandler(async (req, res) => {
  const wishlist = await getWishlist(req.user._id);

  res.json({
    success: true,
    count: wishlist.length,
    wishlist,
  });
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  const productId = req.body.productId || req.query.productId;

  if (!productId) {
    res.status(400);
    throw new Error("productId is required.");
  }

  const deleted = await Wishlist.findOneAndDelete({
    userId: req.user._id,
    productId,
  });

  if (!deleted) {
    res.status(404);
    throw new Error("Wishlist item not found.");
  }

  const wishlist = await getWishlist(req.user._id);

  res.json({
    success: true,
    message: "Item removed from wishlist.",
    wishlist,
  });
});

module.exports = {
  addToWishlist,
  getWishlistItems,
  removeFromWishlist,
};

