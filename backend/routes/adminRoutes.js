const express = require("express");
const {
  getDashboard,
  getAIAnalytics,
  getUsers,
  updateUserStatus,
  getContactQueries,
  updateContactQuery,
  deleteContactQuery,
  getChatQueries,
} = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(protect, adminOnly);

router.get("/dashboard", getDashboard);
router.get("/ai-analytics", getAIAnalytics);
router.get("/users", getUsers);
router.patch("/users/:id/status", updateUserStatus);
router.get("/queries", getContactQueries);
router.patch("/queries/:id", updateContactQuery);
router.delete("/queries/:id", deleteContactQuery);
router.get("/chat-queries", getChatQueries);

module.exports = router;
