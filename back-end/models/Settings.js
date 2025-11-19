import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    general: {
      businessName: String,
      address: String,
      phone: String,
      email: String,
      ownerName: String,
      logoUrl: String,
    },
    inventory: {
      lowStockThreshold: {
        type: Number,
        default: 5,
      },
      showCostPrice: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

const Settings = mongoose.model("Settings", settingsSchema);

export default Settings;

