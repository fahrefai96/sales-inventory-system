import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Product name is required"],
    trim: true,
    minlength: [2, "Product name must be at least 2 characters"],
  },
  description: { type: String, trim: true },

  code: {
    type: String,
    required: [true, "Product code is required"],
    trim: true,
    unique: true,
  },

  price: {
    type: Number,
    required: [true, "Price is required"],
    min: [0, "Price cannot be negative"],
  },
  stock: {
    type: Number,
    required: [true, "Stock quantity is required"],
    min: [0, "Stock cannot be negative"],
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: [true, "Category is required"],
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand",
    required: [true, "Brand is required"],
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
    required: [true, "Supplier is required"],
  },

  // size label from category.sizeOptions
  size: { type: String, required: [true, "Size is required"] },

  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
});

productSchema.index({ code: 1 }, { unique: true });
productSchema.index({ name: 1, isDeleted: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ category: 1 });

const Product = mongoose.model("Product", productSchema);
export default Product;
