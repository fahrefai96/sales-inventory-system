import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  addSupplier,
  getSuppliers,
  updateSupplier,
  deleteSupplier,
  getSupplierProducts,
} from "../Controllers/supplierController.js";

const router = express.Router();

console.log("[SUPPLIER ROUTER LOADED]", import.meta.url);

// Dump the paths/methods defined on THIS router:
setTimeout(() => {
  try {
    const table = (router.stack || [])
      .filter((l) => l?.route)
      .map((l) => ({
        path: l.route.path,
        methods: Object.keys(l.route.methods).join(","),
      }));
    console.log("[SUPPLIER ROUTER ROUTES]", table);
  } catch (e) {
    console.log("[SUPPLIER ROUTER ROUTES] failed:", e.message);
  }
}, 0);

console.log("[supplier router] loaded at", new Date().toISOString());

router.get("/_ping", (req, res) => {
  console.log("[_ping route] Hit!");
  res.json({ ok: true });
});

router.post("/add", authMiddleware, addSupplier);
router.get("/", authMiddleware, getSuppliers);

router.get("/:id/products", authMiddleware, getSupplierProducts);

router.put("/:id", authMiddleware, updateSupplier);
router.delete("/:id", authMiddleware, deleteSupplier);

export default router;
