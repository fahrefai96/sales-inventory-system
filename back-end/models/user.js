import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    address: { type: String, default: "" },
    role: {
      type: String,
      enum: ["admin", "staff"],
      default: "staff",
      index: true,
    },
  },
  { timestamps: true }
);

userSchema.index({ name: 1 });
userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);
export default User;
