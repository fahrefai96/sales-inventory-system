import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { addCustomer, getCustomers, updateCustomer, deleteCustomer } from "../controllers/customerController.js";

const router = express.Router();

// All routes now use authMiddleware like products
router.post("/", authMiddleware, addCustomer);        // POST /api/customer
router.get("/", authMiddleware, getCustomers);        // GET /api/customer
router.put("/:id", authMiddleware, updateCustomer);   // PUT /api/customer/:id
router.delete("/:id", authMiddleware, deleteCustomer); // DELETE /api/customer/:id

export default router;