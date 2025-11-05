import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    minlength: [2, 'Product name must be at least 2 characters'],
  },
  description: {
    type: String,
    trim: true,
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: [true, 'Supplier is required'],
  },
  isDeleted: {type: Boolean, default: false},
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

const Product = mongoose.model('Product', productSchema);
export default Product;