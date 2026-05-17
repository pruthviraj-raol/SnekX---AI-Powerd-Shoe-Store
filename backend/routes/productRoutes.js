const express = require("express");
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
} = require("../controllers/productController");
const { protect, optionalProtect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get("/", optionalProtect, getProducts);
router.get("/:id", getProductById);
router.post("/:id/reviews", protect, createProductReview);
router.post("/", protect, adminOnly, upload.array("images", 6), createProduct);
router.put("/:id", protect, adminOnly, upload.array("images", 6), updateProduct);
router.delete("/:id", protect, adminOnly, deleteProduct);

module.exports = router;
