import mongoose from "mongoose";
import Supplier from "../models/Supplier.js";
import Product from "../models/Product.js";
import Purchase from "../models/Purchase.js";

// POST /api/supplier/add
const addSupplier = async (req, res) => {
  try {
    const { name, email, phone, address, country } = req.body;

    // Only check for duplicates if email is provided
    if (email) {
      const existingSupplier = await Supplier.findOne({ email });
      if (existingSupplier) {
        return res
          .status(400)
          .json({ success: false, error: "Supplier already exists" });
      }
    }

    const supplier = await Supplier.create({
      name,
      email,
      phone,
      address,
      country, // NEW
    });

    return res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      supplier,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// GET /api/supplier
const getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, suppliers });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: "Server error " + error.message });
  }
};

// PUT /api/supplier/:id
const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, country } = req.body;

    const supplier = await Supplier.findByIdAndUpdate(
      id,
      { name, email, phone, address, country },
      { new: true, runValidators: true }
    );

    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, error: "Supplier Not Found" });
    }

    return res.status(200).json({ success: true, supplier });
  } catch (error) {
    console.error("Error editing supplier:", error);
    return res
      .status(500)
      .json({ success: false, error: "Server error " + error.message });
  }
};

// DELETE /api/supplier/:id
const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const count = await Product.countDocuments({
      supplier: id,
      isDeleted: false,
    });
    if (count > 0) {
      return res.status(400).json({
        success: false,
        error:
          "Cannot delete supplier with associated products. Remove or reassign those products first.",
      });
    }

    const supplier = await Supplier.findByIdAndDelete(id);
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, error: "Supplier not found" });
    }

    return res.status(200).json({ success: true, supplier });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    return res
      .status(500)
      .json({ success: false, error: "Server error " + error.message });
  }
};

// GET /api/supplier/:id/products  (NEW)
const getSupplierProducts = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid supplier ID format" });
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, error: "Supplier not found" });
    }

    const products = await Product.find({
      supplier: id,
      isDeleted: { $ne: true },
    })
      .select("code name price stock size createdAt")
      .populate("category", "name")
      .populate("brand", "name")
      .lean();

    return res.status(200).json({
      success: true,
      supplier,
      totalProducts: products.length,
      products,
    });
  } catch (error) {
    console.error("Error fetching supplier products:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Server error",
    });
  }
};

const getSupplierPurchases = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid supplier ID format" });
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, error: "Supplier not found" });
    }

    const purchases = await Purchase.find({ supplier: id })
      .sort({ invoiceDate: -1, createdAt: -1 })
      .select("invoiceNo invoiceDate status grandTotal items createdAt");

    return res.json({
      success: true,
      supplier,
      totalPurchases: purchases.length,
      purchases,
    });
  } catch (error) {
    console.error("Error fetching supplier purchases:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Server error",
    });
  }
};

export {
  addSupplier,
  getSuppliers,
  updateSupplier,
  deleteSupplier,
  getSupplierProducts,
  getSupplierPurchases,
};
