import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Supplier name is required"],
    trim: true,
    minlength: [2, "Supplier name must be at least 2 characters"],
  },
  email: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  address: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Supplier = mongoose.model("Supplier", supplierSchema);
export default Supplier;
