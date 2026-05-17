const parseArrayField = (value) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => parseArrayField(item))
      .filter((item) => item !== "");
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (error) {
        return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
      }
    }

    return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [value];
};

const parseNumberField = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBooleanField = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }

  return Boolean(value);
};

const toImageUrl = (_req, filePath) => {
  if (!filePath) {
    return "";
  }

  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  if (normalized.startsWith("/uploads/")) {
    return normalized;
  }

  if (normalized.includes("/uploads/")) {
    return normalized.slice(normalized.indexOf("/uploads/"));
  }

  return `/uploads/${normalized.split("/").pop()}`;
};

const getUploadedImagePaths = (req) => {
  const files = Array.isArray(req.files) ? req.files : [];
  return files.map((file) => toImageUrl(req, file.path));
};

module.exports = {
  parseArrayField,
  parseNumberField,
  parseBooleanField,
  toImageUrl,
  getUploadedImagePaths,
};
