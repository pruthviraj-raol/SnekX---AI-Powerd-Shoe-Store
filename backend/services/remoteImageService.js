const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");

const { toImageUrl } = require("./requestParserService");
const { uploadsDir } = require("./uploadPathService");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_CONTENT_TYPE_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"]);

const isRemoteHttpUrl = (value = "") => /^https?:\/\//i.test(String(value).trim());
const isDataUrl = (value = "") => /^data:/i.test(String(value).trim());

const isBlockedHostname = (hostname = "") => {
  const normalized = hostname.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  if (["localhost", "0.0.0.0", "::1"].includes(normalized) || normalized.endsWith(".local")) {
    return true;
  }

  if (/^127\./.test(normalized) || /^10\./.test(normalized) || /^192\.168\./.test(normalized) || /^169\.254\./.test(normalized)) {
    return true;
  }

  const private172Match = normalized.match(/^172\.(\d{1,3})\./);
  if (private172Match) {
    const secondOctet = Number(private172Match[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  return false;
};

const ensureUploadsDir = async () => {
  await fs.promises.mkdir(uploadsDir, { recursive: true });
};

const sanitizeFilenameBase = (value = "") => {
  const normalized = value
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized.slice(0, 60) || "product-image";
};

const getExtensionFromUrl = (value = "") => {
  try {
    const parsed = new URL(value);
    const extension = path.extname(parsed.pathname || "").replace(".", "").toLowerCase();
    return ALLOWED_EXTENSIONS.has(extension) ? extension : "";
  } catch (_error) {
    return "";
  }
};

const getImageExtension = (value = "", contentType = "") =>
  IMAGE_CONTENT_TYPE_TO_EXTENSION[contentType] || getExtensionFromUrl(value) || "jpg";

const resolveCandidateUrl = (candidate = "", sourceUrl = "") => {
  const trimmed = candidate.trim();

  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed, sourceUrl).toString();
  } catch (_error) {
    return "";
  }
};

const extractImageUrlFromHtml = (html = "", sourceUrl = "") => {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
    /<img[^>]+src=["']([^"']+)["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const resolvedUrl = resolveCandidateUrl(match?.[1] || "", sourceUrl);

    if (resolvedUrl && !isDataUrl(resolvedUrl)) {
      return resolvedUrl;
    }
  }

  return "";
};

const getFinalResponseUrl = (response, fallbackUrl) => response?.request?.res?.responseUrl || fallbackUrl;

const downloadRemoteAsset = async (sourceUrl) =>
  axios.get(sourceUrl, {
    responseType: "arraybuffer",
    timeout: 15000,
    maxRedirects: 5,
    maxContentLength: MAX_IMAGE_BYTES,
    maxBodyLength: MAX_IMAGE_BYTES,
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (compatible; SnekX/1.0; +https://snekx.local)",
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

const getRemoteImageErrorMessage = (error) => {
  if (axios.isAxiosError(error)) {
    const status = Number(error.response?.status || 0);

    if (status === 404) {
      return "The pasted image URL returned 404 (not found). Please use a direct public image URL or a product page that exposes a preview image.";
    }

    if (status === 401 || status === 403) {
      return "That site blocked the image download. Please use a direct public image URL instead of a protected page.";
    }

    if (error.code === "ECONNABORTED") {
      return "The pasted image URL took too long to respond. Please try a different direct image URL.";
    }
  }

  return "Unable to fetch that image URL. Please use a direct public image URL or a product page that exposes a preview image.";
};


const persistRemoteImage = async (source, depth = 0) => {
  const trimmed = String(source || "").trim();

  if (!trimmed) {
    return "";
  }

  if (isDataUrl(trimmed)) {
    return trimmed;
  }

  if (!isRemoteHttpUrl(trimmed)) {
    return toImageUrl(null, trimmed);
  }

  const parsedUrl = new URL(trimmed);

  if (parsedUrl.pathname.includes("/uploads/")) {
    return toImageUrl(null, parsedUrl.pathname);
  }

  if (isBlockedHostname(parsedUrl.hostname)) {
    throw new Error("Please provide a public image URL.");
  }

  let response;

  try {
    response = await downloadRemoteAsset(trimmed);
  } catch (error) {
    throw new Error(getRemoteImageErrorMessage(error));
  }
  const finalUrl = getFinalResponseUrl(response, trimmed);
  const contentType = String(response.headers["content-type"] || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const assetBuffer = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);
  const isImageResponse =
    contentType.startsWith("image/") ||
    ((!contentType || contentType === "application/octet-stream") && Boolean(getExtensionFromUrl(finalUrl)));

  if (isImageResponse) {
    await ensureUploadsDir();

    const filenameBase = sanitizeFilenameBase(path.basename(new URL(finalUrl).pathname || "product-image"));
    const extension = getImageExtension(finalUrl, contentType);
    const filename = `${Date.now()}-${filenameBase}-${crypto.randomUUID()}.${extension}`;

    await fs.promises.writeFile(path.join(uploadsDir, filename), assetBuffer);
    return toImageUrl(null, `/uploads/${filename}`);
  }

  if (contentType.includes("text/html") && depth < 2) {
    const extractedImageUrl = extractImageUrlFromHtml(assetBuffer.toString("utf8"), finalUrl);

    if (extractedImageUrl && extractedImageUrl !== trimmed) {
      return persistRemoteImage(extractedImageUrl, depth + 1);
    }
  }

  throw new Error("Unable to use that image URL. Please provide a direct image link or a page that exposes a preview image.");
};

const importRemoteImageMap = async (sources = []) => {
  const importedImages = new Map();

  for (const source of sources) {
    const trimmed = String(source || "").trim();

    if (!trimmed || importedImages.has(trimmed)) {
      continue;
    }

    importedImages.set(trimmed, await persistRemoteImage(trimmed));
  }

  return importedImages;
};

module.exports = {
  importRemoteImageMap,
};
