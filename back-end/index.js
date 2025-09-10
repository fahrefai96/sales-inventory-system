import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectdb from "./db/connection.js";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

app.listen(process.env.PORT, () => {
  connectdb();
  console.log(`Server is running on http://localhost:${process.env.PORT}`);
});
