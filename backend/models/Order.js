const mongoose = require("mongoose");

const ORDER_NUMBER_PREFIX = "ORD-SEED";
const ORDER_NUMBER_MIN = 100;
const ORDER_NUMBER_MAX = 999;
const ORDER_NUMBER_RANGE = ORDER_NUMBER_MAX - ORDER_NUMBER_MIN + 1;

const generateRandomOrderSequence = () =>
  Math.floor(Math.random() * ORDER_NUMBER_RANGE) + ORDER_NUMBER_MIN;

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    size: {
      type: Number,
      default: null,
    },
    color: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderNumber: {
      type: String,
      unique: true,
      index: true,
    },
    products: {
      type: [orderItemSchema],
      required: true,
      default: [],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    orderStatus: {
      type: String,
      enum: ["Processing", "Shipped", "Completed", "Cancelled"],
      default: "Processing",
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },
    addressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },
  },
  {
    timestamps: true,
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

orderSchema.statics.formatOrderNumber = function formatOrderNumber(sequence) {
  return `${ORDER_NUMBER_PREFIX}-${String(sequence).padStart(3, "0")}`;
};

orderSchema.statics.generateUniqueOrderNumber = async function generateUniqueOrderNumber() {
  for (let attempt = 0; attempt < ORDER_NUMBER_RANGE; attempt += 1) {
    const candidate = this.formatOrderNumber(generateRandomOrderSequence());
    const exists = await this.exists({ orderNumber: candidate });

    if (!exists) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique order number in the ORD-SEED-### range.");
};

orderSchema.pre("save", async function addOrderNumber(next) {
  if (this.orderNumber) {
    return next();
  }

  try {
    this.orderNumber = await this.constructor.generateUniqueOrderNumber();
    return next();
  } catch (error) {
    return next(error);
  }
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
