import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
});

const Customer = mongoose.model("Customer", customerSchema);
export default Customer;