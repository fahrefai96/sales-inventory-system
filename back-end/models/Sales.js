import mongoose from "mongoose";
const saleSchema = new mongoose.Schema(
  {
    saleId: {
      type: String,
      unique: true,
      required: true,
    },

    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
      },
    ],

    totalAmount: { type: Number, required: true, min: 0 },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // who last updated the sale (optional until first edit)
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    createdAt: { type: Date, default: Date.now },

    // Added saleDate
    saleDate: {
      type: Date,
      default: Date.now,
      required: true,
    },

    // Add discount field (percentage discount, default to 0%)
    discount: {
      type: Number,
      default: 0,
    },

    // Discounted total amount
    discountedAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    //  automatic updatedAt
    timestamps: true,
  }
);

const Sale = mongoose.model("Sale", saleSchema);
export default Sale;
