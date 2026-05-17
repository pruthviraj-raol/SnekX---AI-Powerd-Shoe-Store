const express = require("express");
const { chatbot, outfitRecommendation } = require("../controllers/aiController");
const { optionalProtect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router.post("/chatbot", optionalProtect, chatbot);
router.post("/outfit-recommendation", optionalProtect, upload.single("image"), outfitRecommendation);

module.exports = router;
