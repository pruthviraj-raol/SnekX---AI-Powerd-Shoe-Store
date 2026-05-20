const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const { PassThrough } = require("node:stream");
const express = require("express");

const cloudinary = require("../config/cloudinary");
const upload = require("../middleware/uploadMiddleware");
const { app } = require("../server");
const { toImageUrl } = require("../services/requestParserService");
const { uploadsDir } = require("../services/uploadPathService");

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

const listen = (server) =>
  new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });

const close = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const withCloudinaryEnv = async (callback) => {
  const previousEnv = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };

  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";

  try {
    await callback();
  } finally {
    Object.entries(previousEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
};

test("multer image uploads are sent to Cloudinary with a browser-renderable format", async () => {
  const originalUploadStream = cloudinary.uploader.upload_stream;
  let uploadedOptions = null;

  cloudinary.uploader.upload_stream = (options, callback) => {
    uploadedOptions = options;
    const stream = new PassThrough();
    stream.on("finish", () => {
      callback(null, {
        secure_url: `https://res.cloudinary.com/test-cloud/image/upload/${options.public_id}.${options.format}`,
        bytes: pngBytes.length,
        public_id: options.public_id,
      });
    });
    return stream;
  };

  const uploadApp = express();
  uploadApp.post("/upload", upload.single("image"), (req, res) => {
    res.json({ filename: req.file.filename, path: req.file.path });
  });

  const server = http.createServer(uploadApp);
  const baseUrl = await listen(server);

  try {
    await withCloudinaryEnv(async () => {
      const formData = new FormData();
      formData.append("image", new Blob([pngBytes], { type: "image/png" }), "shoe-photo.png");

      const response = await fetch(`${baseUrl}/upload`, {
        method: "POST",
        body: formData,
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.match(body.filename, /^image-\d+$/);
      assert.match(body.path, /^https:\/\/res\.cloudinary\.com\/test-cloud\/image\/upload\/image-\d+\.png$/);
      assert.equal(uploadedOptions.format, "png");
    });
  } finally {
    cloudinary.uploader.upload_stream = originalUploadStream;
    await close(server);
  }
});

test("image uploads return a clear error when Cloudinary config is missing", async () => {
  const previousEnv = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };

  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;

  const uploadApp = express();
  uploadApp.post("/upload", upload.single("image"), (_req, res) => {
    res.json({ success: true });
  });

  const server = http.createServer(uploadApp);
  const baseUrl = await listen(server);

  try {
    const formData = new FormData();
    formData.append("image", new Blob([pngBytes], { type: "image/png" }), "shoe-photo.png");

    const response = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: formData,
    });
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.deepEqual(body, {
      success: false,
      message: "Cloudinary configuration is missing",
    });
  } finally {
    Object.entries(previousEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
    await close(server);
  }
});

test("legacy extensionless upload files are still served as images", async () => {
  const filename = `legacy-extensionless-${Date.now()}`;
  const filePath = path.join(uploadsDir, filename);
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(filePath, pngBytes);

  const server = http.createServer(app);
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/uploads/${filename}`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
  } finally {
    await close(server);
    await fs.rm(filePath, { force: true });
  }
});

test("upload paths can be generated as absolute backend URLs", () => {
  const previousPublicUrl = process.env.BACKEND_PUBLIC_URL;
  process.env.BACKEND_PUBLIC_URL = "https://snekx-backend.onrender.com";

  try {
    assert.equal(
      toImageUrl(null, path.join(uploadsDir, "image-17123456789.jpg")),
      "https://snekx-backend.onrender.com/uploads/image-17123456789.jpg"
    );
  } finally {
    if (previousPublicUrl === undefined) {
      delete process.env.BACKEND_PUBLIC_URL;
    } else {
      process.env.BACKEND_PUBLIC_URL = previousPublicUrl;
    }
  }
});
