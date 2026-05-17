const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Address = require("../models/Address");
const AIEvent = require("../models/AIEvent");
const asyncHandler = require("../middleware/asyncHandler");
const { buildAIEventProductSnapshot } = require("../services/aiEventSnapshotService");

const normalizeOrderItems = async (userId, productsFromBody) => {
  if (Array.isArray(productsFromBody) && productsFromBody.length) {
    return Promise.all(
      productsFromBody.map(async (item) => {
        const product = await Product.findById(item.productId);
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const quantity = Number(item.quantity || 1);
        if (product.stock < quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }

        return {
          product,
          quantity,
          size: item.size || null,
        };
      })
    );
  }

  const cartItems = await Cart.find({ userId }).populate("productId");
  if (!cartItems.length) {
    throw new Error("Cart is empty. Provide products or add items to cart first.");
  }

  return cartItems.map((item) => ({
    product: item.productId,
    quantity: item.quantity,
    size: item.size,
    cartItemId: item._id,
  }));
};

const createOrder = asyncHandler(async (req, res) => {
  const { addressId, products: productsFromBody, orderStatus, paymentStatus, aiDriven = false } = req.body;

  if (!addressId) {
    res.status(400);
    throw new Error("addressId is required.");
  }

  const address = await Address.findOne({ _id: addressId, userId: req.user._id });
  if (!address) {
    res.status(404);
    throw new Error("Address not found.");
  }

  const normalizedItems = await normalizeOrderItems(req.user._id, productsFromBody);

  const orderItems = normalizedItems.map(({ product, quantity, size }) => ({
    productId: product._id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    image: product.image || product.images[0] || "",
    quantity,
    price: product.price,
    size,
    color: product.color || product.colors[0] || "",
  }));

  const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  for (const item of normalizedItems) {
    item.product.stock -= item.quantity;
    await item.product.save();
  }

  const order = await Order.create({
    userId: req.user._id,
    products: orderItems,
    totalAmount,
    orderStatus: orderStatus || "Processing",
    paymentStatus: paymentStatus || "Pending",
    addressId,
  });

  if (!Array.isArray(productsFromBody) || !productsFromBody.length) {
    const cartIds = normalizedItems.filter((item) => item.cartItemId).map((item) => item.cartItemId);
    if (cartIds.length) {
      await Cart.deleteMany({ _id: { $in: cartIds } });
    }
  }

  for (const item of orderItems) {
    const priorRecommendation = await AIEvent.findOne({
      userId: req.user._id,
      productId: item.productId,
      eventType: "recommendation",
    });

    if (aiDriven || priorRecommendation) {
      await AIEvent.create({
        userId: req.user._id,
        productId: item.productId,
        eventType: "purchase",
        category: item.category || "",
        productSnapshot: buildAIEventProductSnapshot(item),
        purchased: true,
        revenue: item.price * item.quantity,
        timestamp: new Date(),
      });
    }
  }

  const createdOrder = await Order.findById(order._id)
    .populate("addressId")
    .populate("userId", "name email");

  res.status(201).json({
    success: true,
    message: "Order created successfully.",
    order: createdOrder,
  });
});

const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ userId: req.user._id })
    .populate("addressId")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: orders.length,
    orders,
  });
});

const getAllOrders = asyncHandler(async (_req, res) => {
  const orders = await Order.find({})
    .populate("userId", "name email")
    .populate("addressId")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: orders.length,
    orders,
  });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId, orderStatus, paymentStatus } = req.body;

  if (!orderId) {
    res.status(400);
    throw new Error("orderId is required.");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    res.status(404);
    throw new Error("Order not found.");
  }

  if (orderStatus) {
    order.orderStatus = orderStatus;
  }

  if (paymentStatus) {
    order.paymentStatus = paymentStatus;
  }

  await order.save();

  res.json({
    success: true,
    message: "Order updated successfully.",
    order,
  });
});

module.exports = {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
};

