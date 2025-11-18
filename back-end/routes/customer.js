import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  addCustomer,
  getCustomers,
  updateCustomer,
  deleteCustomer,
  getCustomerPurchases,
  getCustomerReceivables,
  getCustomerSalesByPaymentStatus,
  exportCustomersCsv,
  exportCustomersPdf,
} from "../controllers/customerController.js";

const router = express.Router();

// All routes now use authMiddleware like products
router.post("/", authMiddleware, addCustomer); // POST /api/customer
router.get("/", authMiddleware, getCustomers); // GET /api/customer
router.get("/:id/purchases", authMiddleware, getCustomerPurchases); // GET /api/customer/:id/purchases
router.get("/:id/receivables", authMiddleware, getCustomerReceivables); // GET /api/customer/:id/receivables
router.get("/:id/sales", authMiddleware, getCustomerSalesByPaymentStatus); // GET /api/customer/:id/sales
router.put("/:id", authMiddleware, updateCustomer); // PUT /api/customer/:id
router.delete("/:id", authMiddleware, deleteCustomer); // DELETE /api/customer/:id
router.get("/export/csv", authMiddleware, exportCustomersCsv); // GET /api/customers/export/csv
router.get("/export/pdf", authMiddleware, exportCustomersPdf); // GET /api/customers/export/pdf

export default router;
