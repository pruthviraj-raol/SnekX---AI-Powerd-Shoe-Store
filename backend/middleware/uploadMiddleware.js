const fs = require("fs");
const path = require("path");
const multer = require("multer");

const { uploadsDir } = require("../services/uploadPathService");
const IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const getImageExtension = (file) => {
  const originalExtension = path.extname(file.originalname || "").toLowerCase();

  if (ALLOWED_IMAGE_EXTENSIONS.has(originalExtension)) {
    return originalExtension;
  }

  return IMAGE_MIME_EXTENSIONS[file.mimetype] || ".jpg";
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    cb(null, `image-${Date.now()}${getImageExtension(file)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = upload;
