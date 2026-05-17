const express = require("express");
const {
  addToWishlist,
  getWishlistItems,
  removeFromWishlist,
} = require("../controllers/wishlistController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/add", protect, addToWishlist);
router.get("/", protect, getWishlistItems);
router.delete("/remove", protect, removeFromWishlist);

module.exports = router;
