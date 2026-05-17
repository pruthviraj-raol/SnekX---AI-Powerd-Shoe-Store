const sharp = require("sharp");
const Product = require("../models/Product");

const tokenizeQuery = (input = "") =>
  input
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);

const rgbToHsl = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h;
  let s;
  const l = (max + min) / 2;

  if (max === min) {
    h = 0;
    s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }

    h /= 6;
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
};

const mapRgbToColorName = (r, g, b) => {
  const { h, s, l } = rgbToHsl(r, g, b);

  if (l < 15) return "Black";
  if (l > 85 && s < 20) return "White";
  if (s < 18) return "Grey";
  if (h >= 0 && h < 20) return "Red";
  if (h >= 20 && h < 45) return "Brown";
  if (h >= 45 && h < 70) return "Yellow";
  if (h >= 70 && h < 170) return "Green";
  if (h >= 170 && h < 260) return "Blue";
  if (h >= 260 && h < 330) return "Purple";
  return "Red";
};

const getClothingCropRegion = ({ width = 1, height = 1 } = {}) => {
  const left = Math.max(0, Math.floor(width * 0.3));
  const top = Math.max(0, Math.floor(height * 0.3));
  const cropWidth = Math.max(1, Math.min(width - left, Math.floor(width * 0.4)));
  const cropHeight = Math.max(1, Math.min(height - top, Math.floor(height * 0.5)));

  return {
    left,
    top,
    width: cropWidth,
    height: cropHeight,
  };
};

const getFilteredPixels = (buffer) => {
  const allPixels = [];
  const filteredPixels = [];

  for (let index = 0; index < buffer.length; index += 3) {
    const pixel = [buffer[index], buffer[index + 1], buffer[index + 2]];
    const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
    allPixels.push(pixel);

    if (brightness > 30 && brightness < 220) {
      filteredPixels.push(pixel);
    }
  }

  return filteredPixels.length ? filteredPixels : allPixels;
};

const averagePixels = (pixels = []) => {
  if (!pixels.length) {
    return { r: 0, g: 0, b: 0 };
  }

  const totals = pixels.reduce(
    (sum, pixel) => ({
      r: sum.r + pixel[0],
      g: sum.g + pixel[1],
      b: sum.b + pixel[2],
    }),
    { r: 0, g: 0, b: 0 }
  );

  return {
    r: Math.round(totals.r / pixels.length),
    g: Math.round(totals.g / pixels.length),
    b: Math.round(totals.b / pixels.length),
  };
};

const detectDominantColor = async (imagePath) => {
  const metadata = await sharp(imagePath).metadata();
  const buffer = await sharp(imagePath)
    .extract(getClothingCropRegion(metadata))
    .resize(100, 100, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();

  const pixels = getFilteredPixels(buffer);
  const { r, g, b } = averagePixels(pixels);
  return {
    color: mapRgbToColorName(r, g, b),
    rgb: { r, g, b },
  };
};

const getFallbackProducts = async (limit = 6) =>
  Product.find({})
    .sort({ isTrending: -1, isNew: -1, createdAt: -1 })
    .limit(limit);

const findChatbotRecommendations = async (message, limit = 6) => {
  const keywords = tokenizeQuery(message);

  if (!keywords.length) {
    return getFallbackProducts(limit);
  }

  const orConditions = keywords.flatMap((keyword) => {
    const regex = new RegExp(keyword, "i");
    return [
      { name: regex },
      { brand: regex },
      { category: regex },
      { type: regex },
      { description: regex },
      { tags: regex },
      { color: regex },
      { colors: regex },
    ];
  });

  const matches = await Product.find({ $or: orConditions })
    .sort({ isTrending: -1, stock: -1, createdAt: -1 })
    .limit(limit);

  return matches.length ? matches : getFallbackProducts(limit);
};

const buildChatbotReply = (message, products) => {
  if (!products.length) {
    return "I could not find an exact match right now, but I can help if you try a brand, category, or color.";
  }

  const productNames = products.slice(0, 3).map((product) => product.name).join(", ");
  return `Based on "${message}", I found a few strong matches for you: ${productNames}.`;
};

const findOutfitRecommendations = async (detectedColor, limit = 6) => {
  const regex = new RegExp(detectedColor, "i");

  let products = await Product.find({
    $or: [{ color: regex }, { colors: regex }],
  })
    .sort({ stock: -1, isTrending: -1, createdAt: -1 })
    .limit(limit);

  if (products.length) {
    return products;
  }

  const categoryFallbacks = {
    Black: "lifestyle",
    White: "lifestyle",
    Grey: "lifestyle",
    Red: "running",
    Blue: "running",
    Green: "training",
    Brown: "lifestyle",
    Yellow: "lifestyle",
    Purple: "lifestyle",
  };

  const fallbackType = categoryFallbacks[detectedColor] || "lifestyle";
  products = await Product.find({ type: new RegExp(fallbackType, "i") })
    .sort({ stock: -1, createdAt: -1 })
    .limit(limit);

  return products.length ? products : getFallbackProducts(limit);
};

module.exports = {
  detectDominantColor,
  findChatbotRecommendations,
  buildChatbotReply,
  findOutfitRecommendations,
};
