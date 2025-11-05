import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectdb from "./db/connection.js";
import authRoutes from "./routes/auth.js";
import categoryRouter from "./routes/category.js"
import supplierRouter from "./routes/supplier.js"
import dashboardRouter from "./routes/dashboard.js"
import productRouter from "./routes/product.js"
import salesRouter from "./routes/sales.js";
import customerRouter from "./routes/customer.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/dashboard", dashboardRouter);
app.use("/api/auth", authRoutes);
app.use("/api/category", categoryRouter);
app.use("/api/supplier", supplierRouter);
app.use("/api/products", productRouter);
app.use("/api/sales", salesRouter);
app.use("/api/customers", customerRouter);

app.listen(process.env.PORT, () => {
  connectdb();
  console.log(`Server is running on http://localhost:${process.env.PORT}`);
});
