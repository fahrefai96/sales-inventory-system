// seed.js
import bcrypt from "bcrypt";
import User from "./models/User.js";
import connectdb from "./db/connection.js";

const register = async () => {
  try {
    await connectdb();

    const existingAdmin = await User.findOne({ email: "admin@gmail.com" });
    if (!existingAdmin) {
      const hashPassword = await bcrypt.hash("admin", 10);
      const newUser = new User({
        name: "admin",
        email: "admin@gmail.com",
        password: hashPassword,
        address: "admin address",
        role: "admin", // make sure this matches enum in your model
      });
      await newUser.save();
      console.log("✅ Admin user created successfully");
    } else {
      console.log("ℹ️ Admin user already exists");
    }

    const existingStaff = await User.findOne({ email: "staff@gmail.com" });
    if (!existingStaff) {
      const hashPassword = await bcrypt.hash("staff", 10);
      const newStaff = new User({
        name: "staff",
        email: "staff@gmail.com",
        password: hashPassword,
        address: "staff address",
        role: "staff",
      });
      await newStaff.save();
      console.log("✅ Staff user created successfully");
    } else {
      console.log("ℹ️ Staff user already exists");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding users:", error);
    process.exit(1);
  }
};

register();
