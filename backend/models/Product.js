const mongoose = require("mongoose");
const {
  PRODUCT_CATEGORIES,
  PRODUCT_TYPES,
  PRODUCT_COLORS,
  normalizeProductAttributes,
} = require("../services/productTaxonomyService");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: PRODUCT_CATEGORIES,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: PRODUCT_TYPES,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    originalPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    sizes: {
      type: [Number],
      default: [],
    },
    color: {
      type: String,
      trim: true,
      lowercase: true,
      enum: PRODUCT_COLORS,
      default: "black",
    },
    colors: {
      type: [
        {
          type: String,
          trim: true,
          lowercase: true,
          enum: PRODUCT_COLORS,
        },
      ],
      default: ["black", "white"],
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 2,
        message: "Products must include at least two colors.",
      },
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    image: {
      type: String,
      default: "",
    },
    images: {
      type: [String],
      required: true,
      default: [],
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    numReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    reviews: {
      type: [reviewSchema],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    isNew: {
      type: Boolean,
      default: false,
    },
    isTrending: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.numReviews = typeof ret.numReviews === "number" ? ret.numReviews : Array.isArray(ret.reviews) ? ret.reviews.length : 0;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

productSchema.pre("init", function migrateLegacyReviewCount(data) {
  if (data && typeof data.reviews === "number") {
    data.numReviews = typeof data.numReviews === "number" ? data.numReviews : data.reviews;
    data.reviews = [];
  }
});

productSchema.pre("validate", function normalizeTaxonomy(next) {
  const normalizedImages = Array.isArray(this.images)
    ? this.images.map((image) => String(image || "").trim()).filter(Boolean)
    : [];

  this.image = typeof this.image === "string" ? this.image.trim() : "";

  if (this.image && !normalizedImages.length) {
    normalizedImages.push(this.image);
  }

  this.images = normalizedImages;

  if (!this.image && normalizedImages.length) {
    this.image = normalizedImages[0];
  }

  const normalized = normalizeProductAttributes({
    category: this.category,
    type: this.type,
    color: this.color,
    colors: this.colors,
    name: this.name,
    description: this.description,
    tags: this.tags,
  });

  this.category = normalized.category;
  this.type = normalized.type;
  this.color = normalized.color;
  this.colors = normalized.colors;

  next();
});

module.exports = mongoose.model("Product", productSchema);

