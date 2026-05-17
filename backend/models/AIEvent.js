const mongoose = require("mongoose");

const productSnapshotSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
      trim: true,
    },
    brand: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    image: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const aiEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    eventType: {
      type: String,
      enum: ["recommendation", "click", "purchase"],
      required: true,
    },
    category: {
      type: String,
      default: "",
    },
    productSnapshot: {
      type: productSnapshotSchema,
      default: () => ({}),
    },
    clicked: {
      type: Boolean,
      default: false,
    },
    purchased: {
      type: Boolean,
      default: false,
    },
    revenue: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("AIEvent", aiEventSchema);

