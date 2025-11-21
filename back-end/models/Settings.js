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
    sales: {
      defaultPaymentMethod: {
        type: String,
        enum: ["choose", "cash", "cheque"],
        default: "choose",
      },
    },
    chatbot: {
      mode: {
        type: String,
        enum: ["RULE_ONLY", "OPENAI_ONLY", "HYBRID", "DISABLED"],
        default: "HYBRID",
      },
    },
  },
  {
    timestamps: true,
  }
);

const Settings = mongoose.model("Settings", settingsSchema);

export default Settings;

