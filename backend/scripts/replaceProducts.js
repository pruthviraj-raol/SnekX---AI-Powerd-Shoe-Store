const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const Product = require("../models/Product");
const baseProducts = require("../data/productSeedData");
const { normalizeProductAttributes } = require("../services/productTaxonomyService");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const getProductKey = (product = {}) =>
  `${String(product.name || "").trim().toLowerCase()}::${String(product.brand || "").trim().toLowerCase()}`;

const products = baseProducts.map((product) => {
  const normalizedTaxonomy = normalizeProductAttributes(product);
  const images = Array.isArray(product.images)
    ? product.images.map((image) => String(image || "").trim()).filter(Boolean)
    : [];

  if (product.image && !images.length) {
    images.push(product.image);
  }

  return {
    ...product,
    ...normalizedTaxonomy,
    image: product.image || images[0] || "",
    images,
    stock: Number.isFinite(product.stock) ? product.stock : 25,
    rating: Number.isFinite(product.rating) ? product.rating : 0,
    numReviews: Number.isFinite(product.numReviews) ? product.numReviews : 0,
    reviews: Array.isArray(product.reviews) ? product.reviews : [],
    isNew: Boolean(product.isNew),
    isTrending: Boolean(product.isTrending),
  };
});

const replaceProducts = async () => {
  try {
    await connectDB();

    const existingProducts = await Product.find({}).select("_id name brand");
    const existingIdByKey = new Map(
      existingProducts.map((product) => [getProductKey(product), product._id])
    );
    const nextProducts = products.map((product) => {
      const existingId = existingIdByKey.get(getProductKey(product));

      return existingId ? { _id: existingId, ...product } : product;
    });
    const existingCount = existingProducts.length;
    await Product.deleteMany({});
    const createdProducts = await Product.insertMany(nextProducts);
    const preservedIds = nextProducts.filter((product) => product._id).length;

    console.log(`Deleted ${existingCount} existing products.`);
    console.log(`Inserted ${createdProducts.length} products.`);
    console.log(`Preserved ${preservedIds} product IDs for matching products.`);
  } catch (error) {
    console.error(`Replacing products failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

replaceProducts();

