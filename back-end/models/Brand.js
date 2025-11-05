import mongoose from "mongoose";

const brandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Brand name is required"],
    trim: true,
    minlength: [2, "Brand name must be at least 2 characters"],
    unique: true,
  },
  description: { type: String, trim: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

brandSchema.index({ name: 1 }, { unique: true });

const Brand = mongoose.model("Brand", brandSchema);
export default Brand;
