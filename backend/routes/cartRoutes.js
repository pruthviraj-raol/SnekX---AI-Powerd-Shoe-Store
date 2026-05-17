const express = require("express");
const { addToCart, getCartItems, removeFromCart } = require("../controllers/cartController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/add", protect, addToCart);
router.get("/", protect, getCartItems);
router.delete("/remove", protect, removeFromCart);

module.exports = router;
