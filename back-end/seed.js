import bcrypt from "bcrypt";
import User from "./models/User.js";
import connectdb from "./db/connection.js";

const register = async () => {
  try {
    connectdb();
    const hashPassword = await bcrypt.hash("admin", 10);
    const newUser = new User({
      name: "admin",
      email: "admin@gmail.com",
      password: hashPassword,
      address: "admin address",
      role: "Admin",
    });
    await newUser.save();
    console.log("Admin user created succesfully");
  } catch (error) {
    console.log(error);
  }
};

register();
