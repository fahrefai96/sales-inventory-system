console.log("SERVER ENTRY:", import.meta.url);

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectdb from "./db/connection.js";

import authRoutes from "./routes/auth.js";
import categoryRouter from "./routes/category.js";
import supplierRouter from "./routes/supplier.js";
import dashboardRouter from "./routes/dashboard.js";
import productRouter from "./routes/product.js";
import salesRouter from "./routes/sales.js";
import customerRouter from "./routes/customer.js";
import usersRoute from "./routes/users.js";
import brandRoutes from "./routes/brands.js";
import inventoryLogsRoutes from "./routes/inventory-logs.js";

console.log("Mounted /api/supplier at", new Date().toISOString());

dotenv.config();

const app = express();

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const corsConfig = {
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Disposition"],
};

app.use(cors(corsConfig));

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", CORS_ORIGIN);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Expose-Headers", "Content-Disposition");
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

// Debug: Log ALL incoming requests (moved before route registration)
app.use((req, res, next) => {
  console.log(`\n[REQUEST] ${req.method} ${req.path}`);
  console.log(`[REQUEST] Full URL: ${req.originalUrl}`);
  console.log(
    `[REQUEST] Headers:`,
    req.headers["authorization"] ? "Has Auth" : "No Auth"
  );
  next();
});

app.use("/api/dashboard", dashboardRouter);
app.use("/api/auth", authRoutes);
app.use("/api/category", categoryRouter);

app.use("/api/supplier", supplierRouter);

app.use("/api/products", productRouter);
app.use("/api/sales", salesRouter);
app.use("/api/customers", customerRouter);
app.use("/api/users", usersRoute);
app.use("/api/brands", brandRoutes);
app.use("/api/inventory-logs", inventoryLogsRoutes);

// Catch-all for debugging 404s
app.use((req, res, next) => {
  if (req.path.includes("supplier") && req.path.includes("products")) {
    console.log(`[404 DEBUG] Unmatched route: ${req.method} ${req.path}`);
    console.log(
      `[404 DEBUG] Full URL: ${req.protocol}://${req.get("host")}${
        req.originalUrl
      }`
    );
  }
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    availableRoutes: [
      "GET /api/supplier",
      "GET /api/supplier/:id/products",
      "POST /api/supplier/add",
    ],
  });
});

app.listen(process.env.PORT, () => {
  connectdb();
  console.log(`Server is running on http://localhost:${process.env.PORT}`);
});
