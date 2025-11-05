import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, unique: true },
  password: String,
  profilePic: { type: String, default: "" },
  address: { type: String },
  role: { type: String, enum: ["admin", "staff"], default: "staff" },
});
const User = mongoose.model("User", UserSchema);
export default User;
