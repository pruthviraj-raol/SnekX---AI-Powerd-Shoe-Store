const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const addressRoutes = require("./routes/addressRoutes");
const orderRoutes = require("./routes/orderRoutes");
const aiRoutes = require("./routes/aiRoutes");
const adminRoutes = require("./routes/adminRoutes");
const contactRoutes = require("./routes/contactRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { ensureDefaultAdmin } = require("./services/bootstrapService");
const { uploadsDir } = require("./services/uploadPathService");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const PRODUCTION_CLIENT_URL = "https://snek-x-ai-powerd-shoe-store.vercel.app";
const BACKEND_VERSION = "2026-05-26-ai-service-url-fallback";
const isProduction = process.env.NODE_ENV === "production";
let serverInstance = null;
const IMAGE_CONTENT_TYPES = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const parseOrigins = (value = "") =>
  value
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

const configuredOrigins = parseOrigins(
  process.env.CLIENT_URL || process.env.CLIENT_ORIGINS || (isProduction ? PRODUCTION_CLIENT_URL : "")
);

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = origin.replace(/\/$/, "");

  if (configuredOrigins.includes(normalizedOrigin)) {
    return true;
  }

  return !isProduction && configuredOrigins.length === 0;
};

const ensureUploadsDir = () => {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
};

const inferImageContentType = (filePath) => {
  const extensionContentType = IMAGE_CONTENT_TYPES[path.extname(filePath).toLowerCase()];

  if (extensionContentType) {
    return extensionContentType;
  }

  const signature = Buffer.alloc(16);
  let bytesRead = 0;

  try {
    const fileHandle = fs.openSync(filePath, "r");
    bytesRead = fs.readSync(fileHandle, signature, 0, signature.length, 0);
    fs.closeSync(fileHandle);
  } catch (_error) {
    return "";
  }

  if (bytesRead >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff) {
    return "image/jpeg";
  }

  if (bytesRead >= 8 && signature.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }

  if (bytesRead >= 6 && (signature.subarray(0, 6).toString("ascii") === "GIF87a" || signature.subarray(0, 6).toString("ascii") === "GIF89a")) {
    return "image/gif";
  }

  if (bytesRead >= 12 && signature.subarray(0, 4).toString("ascii") === "RIFF" && signature.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }

  if (bytesRead >= 12 && signature.subarray(4, 12).toString("ascii").includes("ftypavif")) {
    return "image/avif";
  }

  return "";
};

const setUploadHeaders = (res, filePath) => {
  const contentType = inferImageContentType(filePath);

  if (contentType) {
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
};

ensureUploadsDir();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use("/uploads", express.static(uploadsDir, { setHeaders: setUploadHeaders }));

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "SnekX backend is running.",
    version: BACKEND_VERSION,
    aiServiceConfigured: Boolean(process.env.AI_SERVICE_URL),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/address", addressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  if (serverInstance) {
    return serverInstance;
  }

  try {
    await connectDB();
    await ensureDefaultAdmin();
    serverInstance = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    return serverInstance;
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

const shutdown = (signal) => {
  if (!serverInstance) {
    process.exit(0);
  }

  serverInstance.close(() => {
    console.log(`Server stopped on ${signal}`);
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};
