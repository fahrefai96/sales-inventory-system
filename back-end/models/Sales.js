import mongoose from "mongoose";

const saleSchema = new mongoose.Schema({
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

  createdAt: { type: Date, default: Date.now },
});

const Sale = mongoose.model("Sale", saleSchema);
export default Sale;