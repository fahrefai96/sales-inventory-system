import mongoose from "mongoose";

const connectdb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("connection created succesffuly");
  } catch (error) {
    console.error("connection failed", error.message);
    process.exit(1);
  }
};

export default connectdb;
