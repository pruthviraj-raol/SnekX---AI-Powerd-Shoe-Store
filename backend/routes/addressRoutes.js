const express = require("express");
const {
  addAddress,
  getAddresses,
  updateAddress,
  deleteAddress,
} = require("../controllers/addressController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/add", protect, addAddress);
router.get("/", protect, getAddresses);
router.put("/update", protect, updateAddress);
router.delete("/delete", protect, deleteAddress);

module.exports = router;
