import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Category name is required"],
    unique: true,
    trim: true,
    minlength: [2, "Category name must be at least 2 characters"],
  },
  description: { type: String, trim: true },

  // Every category has sizes via one of these modes
  sizeMode: {
    type: String,
    enum: ["fixed", "custom"], // fixed = Small/Medium/Large, custom = you provide list
    required: true,
    default: "fixed",
  },
  // If sizeMode=fixed we will force this to ["Small","Medium","Large"] in controller
  // If sizeMode=custom we will save what you provide (must be non-empty)
  sizeOptions: {
    type: [String],
    default: [], // stored list used by products to pick size
  },

  createdAt: { type: Date, default: Date.now },
});

const Category = mongoose.model("Category", categorySchema);
export default Category;
