const Cart = require("../models/Cart");
const Product = require("../models/Product");
const asyncHandler = require("../middleware/asyncHandler");

const getUserCart = async (userId) =>
  Cart.find({ userId })
    .populate("productId")
    .sort({ createdAt: -1 });

const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, size = null } = req.body;

  if (!productId) {
    res.status(400);
    throw new Error("productId is required.");
  }

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found.");
  }

  if (product.stock < Number(quantity)) {
    res.status(400);
    throw new Error("Requested quantity exceeds available stock.");
  }

  const existingItem = await Cart.findOne({
    userId: req.user._id,
    productId,
    size,
  });

  if (existingItem) {
    existingItem.quantity += Number(quantity);
    existingItem.price = product.price;
    await existingItem.save();
  } else {
    await Cart.create({
      userId: req.user._id,
      productId,
      quantity: Number(quantity),
      price: product.price,
      size,
    });
  }

  const cartItems = await getUserCart(req.user._id);

  res.status(201).json({
    success: true,
    message: "Item added to cart.",
    cart: cartItems,
  });
});

const getCartItems = asyncHandler(async (req, res) => {
  const cartItems = await getUserCart(req.user._id);

  res.json({
    success: true,
    count: cartItems.length,
    cart: cartItems,
  });
});

const removeFromCart = asyncHandler(async (req, res) => {
  const productId = req.body.productId || req.query.productId;
  const size = req.body.size ?? req.query.size ?? undefined;

  if (!productId) {
    res.status(400);
    throw new Error("productId is required.");
  }

  const query = { userId: req.user._id, productId };
  if (size !== undefined && size !== "") {
    query.size = Number(size);
  }

  const deleted = await Cart.findOneAndDelete(query);
  if (!deleted) {
    res.status(404);
    throw new Error("Cart item not found.");
  }

  const cartItems = await getUserCart(req.user._id);

  res.json({
    success: true,
    message: "Item removed from cart.",
    cart: cartItems,
  });
});

module.exports = {
  addToCart,
  getCartItems,
  removeFromCart,
};
