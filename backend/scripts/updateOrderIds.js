const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const Order = require("../models/Order");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const START_SEQUENCE = 100;

const updateOrderIds = async () => {
  try {
    await connectDB();

    const orders = await Order.find({})
      .sort({ createdAt: 1, _id: 1 })
      .select("_id orderNumber createdAt");

    if (!orders.length) {
      console.log("No orders found to update.");
      return;
    }

    const usedOrderNumbers = new Set();
    const updates = [];
    let nextSequence = START_SEQUENCE;

    for (const order of orders) {
      let nextOrderNumber = Order.formatOrderNumber(nextSequence);

      while (usedOrderNumbers.has(nextOrderNumber)) {
        nextSequence += 1;
        nextOrderNumber = Order.formatOrderNumber(nextSequence);
      }

      usedOrderNumbers.add(nextOrderNumber);
      nextSequence += 1;

      if (order.orderNumber === nextOrderNumber) {
        continue;
      }

      updates.push({
        updateOne: {
          filter: { _id: order._id },
          update: { $set: { orderNumber: nextOrderNumber } },
        },
      });
    }

    if (!updates.length) {
      console.log("Order IDs are already standardized.");
      return;
    }

    const result = await Order.bulkWrite(updates, { ordered: true });
    console.log(`Updated ${result.modifiedCount || updates.length} orders to ORD-SEED format.`);
  } catch (error) {
    console.error(`Order ID update failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

updateOrderIds();
