// models/Purchase.js
import mongoose from "mongoose";

const PurchaseItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    unitCost: {
      type: Number,
      required: true,
      min: [0, "Unit cost cannot be negative"],
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const PurchaseSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
    },
    invoiceNo: { type: String, trim: true },
    invoiceDate: { type: Date },

    status: {
      type: String,
      enum: ["draft", "posted", "cancelled"],
      default: "draft",
      index: true,
    },

    items: {
      type: [PurchaseItemSchema],
      validate: [
        (v) => Array.isArray(v) && v.length > 0,
        "At least one item is required",
      ],
    },

    subTotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },

    note: { type: String, trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true },
  },
  { timestamps: true }
);

PurchaseSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Purchase", PurchaseSchema);
