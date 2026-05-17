const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const AIEvent = require("../models/AIEvent");
const Order = require("../models/Order");
const Product = require("../models/Product");
const {
  buildAIEventProductSnapshot,
  hasAIEventProductSnapshot,
} = require("../services/aiEventSnapshotService");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const trimValue = (value = "") => String(value || "").trim();

const buildSnapshotUpdate = (existingSnapshot, fallbackSnapshot, categoryFallback) => {
  const mergedSnapshot = {
    name: trimValue(existingSnapshot?.name) || trimValue(fallbackSnapshot?.name),
    brand: trimValue(existingSnapshot?.brand) || trimValue(fallbackSnapshot?.brand),
    category:
      trimValue(existingSnapshot?.category) ||
      trimValue(fallbackSnapshot?.category) ||
      trimValue(categoryFallback).toLowerCase(),
    image: trimValue(existingSnapshot?.image) || trimValue(fallbackSnapshot?.image),
  };

  return hasAIEventProductSnapshot(mergedSnapshot) ? mergedSnapshot : null;
};

const backfillAIEventSnapshots = async () => {
  try {
    await connectDB();

    const events = await AIEvent.find({ productId: { $exists: true, $ne: null } }).select(
      "_id productId category productSnapshot"
    );

    if (!events.length) {
      console.log("No AI events found to backfill.");
      return;
    }

    const uniqueProductIds = Array.from(
      new Map(events.map((event) => [String(event.productId), event.productId])).values()
    );

    const [products, orderProducts] = await Promise.all([
      Product.find({ _id: { $in: uniqueProductIds } }).select("_id name brand category image images"),
      Order.aggregate([
        { $unwind: "$products" },
        { $match: { "products.productId": { $in: uniqueProductIds } } },
        {
          $group: {
            _id: "$products.productId",
            name: { $first: "$products.name" },
            brand: { $first: "$products.brand" },
            image: { $first: "$products.image" },
          },
        },
      ]),
    ]);

    const snapshotByProductId = new Map(
      products.map((product) => [String(product._id), buildAIEventProductSnapshot(product)])
    );

    for (const orderProduct of orderProducts) {
      const productId = String(orderProduct._id);

      if (!snapshotByProductId.has(productId)) {
        snapshotByProductId.set(productId, buildAIEventProductSnapshot(orderProduct));
      }
    }

    const updates = events
      .map((event) => {
        const fallbackSnapshot = snapshotByProductId.get(String(event.productId));
        const nextSnapshot = buildSnapshotUpdate(event.productSnapshot, fallbackSnapshot, event.category);

        if (!nextSnapshot) {
          return null;
        }

        const currentSnapshot = {
          name: trimValue(event.productSnapshot?.name),
          brand: trimValue(event.productSnapshot?.brand),
          category: trimValue(event.productSnapshot?.category).toLowerCase(),
          image: trimValue(event.productSnapshot?.image),
        };

        const nextCategory = trimValue(event.category) || nextSnapshot.category;
        const categoryChanged = trimValue(event.category) !== nextCategory;
        const snapshotChanged =
          currentSnapshot.name !== nextSnapshot.name ||
          currentSnapshot.brand !== nextSnapshot.brand ||
          currentSnapshot.category !== nextSnapshot.category ||
          currentSnapshot.image !== nextSnapshot.image;

        if (!snapshotChanged && !categoryChanged) {
          return null;
        }

        return {
          updateOne: {
            filter: { _id: event._id },
            update: {
              $set: {
                productSnapshot: nextSnapshot,
                ...(nextCategory ? { category: nextCategory } : {}),
              },
            },
          },
        };
      })
      .filter(Boolean);

    if (!updates.length) {
      console.log("AI event snapshots are already up to date.");
      return;
    }

    const result = await AIEvent.bulkWrite(updates, { ordered: false });
    console.log(`Backfilled ${result.modifiedCount || updates.length} AI events with product snapshots.`);
  } catch (error) {
    console.error(`AI event snapshot backfill failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

backfillAIEventSnapshots();

