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
  },
  {
    timestamps: true,
  }
);

const Settings = mongoose.model("Settings", settingsSchema);

export default Settings;

