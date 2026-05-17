const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const Product = require("../models/Product");
const { normalizeProductAttributes } = require("../services/productTaxonomyService");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const normalizeProducts = async () => {
  try {
    await connectDB();

    const products = await Product.find({});
    const updates = products
      .map((product) => {
        const normalized = normalizeProductAttributes(product.toObject());
        const currentColors = JSON.stringify(product.colors || []);
        const nextColors = JSON.stringify(normalized.colors);
        const isChanged =
          product.category !== normalized.category ||
          product.type !== normalized.type ||
          product.color !== normalized.color ||
          currentColors !== nextColors;

        if (!isChanged) {
          return null;
        }

        return {
          updateOne: {
            filter: { _id: product._id },
            update: { $set: normalized },
          },
        };
      })
      .filter(Boolean);

    if (!updates.length) {
      console.log("Products are already normalized.");
      return;
    }

    const result = await Product.bulkWrite(updates);
    console.log(`Normalized ${result.modifiedCount || updates.length} products.`);
  } catch (error) {
    console.error(`Product normalization failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

normalizeProducts();
