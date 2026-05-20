const multer = require("multer");
const path = require("path");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const REQUIRED_CLOUDINARY_ENV_VARS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const isCloudinaryConfigured = () =>
  REQUIRED_CLOUDINARY_ENV_VARS.every((envVar) => Boolean(process.env[envVar]));

const requireCloudinaryConfig = (_req, res, next) => {
  if (!isCloudinaryConfigured()) {
    return res.status(500).json({
      success: false,
      message: "Cloudinary configuration is missing",
    });
  }

  next();
};

const withCloudinaryConfig = (middleware) => [requireCloudinaryConfig, middleware];

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
]);

const IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const getImageFormat = (file) => {
  const originalExtension = path
    .extname(file.originalname || "")
    .toLowerCase();

  if (ALLOWED_IMAGE_EXTENSIONS.has(originalExtension)) {
    return originalExtension.replace(".", "");
  }

  return IMAGE_MIME_EXTENSIONS[file.mimetype] || "jpg";
};

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => ({
    folder: "snekx-products",
    format: getImageFormat(file),
    public_id: `image-${Date.now()}`,
  }),
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

module.exports = {
  any: () => withCloudinaryConfig(upload.any()),
  array: (...args) => withCloudinaryConfig(upload.array(...args)),
  fields: (...args) => withCloudinaryConfig(upload.fields(...args)),
  none: () => withCloudinaryConfig(upload.none()),
  single: (...args) => withCloudinaryConfig(upload.single(...args)),
};
