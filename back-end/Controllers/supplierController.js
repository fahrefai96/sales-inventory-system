import mongoose from "mongoose";
import Supplier from "../models/Supplier.js";
import Product from "../models/Product.js";
import Purchase from "../models/Purchase.js";
import PDFDocument from "pdfkit";
import { getBusinessInfo, addBusinessHeader } from "../utils/pdfHelpers.js";

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
    const {
      search = "",
      page = "1",
      limit = "25",
      sortBy = "createdAt", // "name" | "email" | "phone" | "country" | "createdAt"
      sortDir = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 25));
    const sortDirNum = sortDir === "asc" ? 1 : -1;

    // Build query
    const q = {};
    if (search && search.trim()) {
      q.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
        { phone: { $regex: search.trim(), $options: "i" } },
        { address: { $regex: search.trim(), $options: "i" } },
        { country: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // Build sort
    const sort = {};
    if (sortBy === "name") sort.name = sortDirNum;
    else if (sortBy === "email") sort.email = sortDirNum;
    else if (sortBy === "phone") sort.phone = sortDirNum;
    else if (sortBy === "country") sort.country = sortDirNum;
    else sort.createdAt = sortDirNum; // default: createdAt

    // Get total count
    const total = await Supplier.countDocuments(q);

    // Get paginated results
    const skip = (pageNum - 1) * limitNum;
    const suppliers = await Supplier.find(q)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    return res.status(200).json({
      success: true,
      suppliers,
      total,
      page: pageNum,
      limit: limitNum,
    });
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
      .limit(10)
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

const sendCsv = (res, filename, headers, rows) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const esc = (v) =>
    `"${String(v ?? "")
      .replaceAll('"', '""')
      .replaceAll(/\r?\n/g, " ")}"`;
  const head = headers.map(esc).join(",") + "\n";
  const body = rows
    .map((r) => headers.map((h) => esc(r[h])).join(","))
    .join("\n");
  res.send(head + body);
};

const pipeDoc = (res, filename) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  doc.on("error", (err) => {
    console.error("PDF error:", err);
    try {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "PDF generation failed" });
      }
      doc.destroy();
    } catch {}
  });
  doc.pipe(res);
  return doc;
};

export const exportSuppliersCsv = async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ createdAt: -1 }).lean();

    const rows = suppliers.map((s) => ({
      name: s.name || "-",
      email: s.email || "-",
      phone: s.phone || "-",
      address: s.address || "-",
      country: s.country || "-",
    }));

    sendCsv(
      res,
      `suppliers_${new Date().toISOString().slice(0, 10)}.csv`,
      ["name", "email", "phone", "address", "country"],
      rows
    );
  } catch (error) {
    console.error("Export suppliers CSV error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

export const exportSuppliersPdf = async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ createdAt: -1 }).lean();

    const doc = pipeDoc(res, `suppliers_${new Date().toISOString().slice(0, 10)}.pdf`);
    
    // Fetch and add business information header
    const businessInfo = await getBusinessInfo();
    addBusinessHeader(doc, businessInfo);
    
    doc.fontSize(16).text("Suppliers Report", { align: "left" }).moveDown(0.3);
    doc
      .fontSize(10)
      .text(
        `Generated: ${new Date().toLocaleString("en-LK", {
          timeZone: "Asia/Colombo",
        })}`
      );
    doc.moveDown(0.8);

    doc.fontSize(12).text("Suppliers", { underline: true });
    doc.moveDown(0.3).fontSize(10);

    suppliers.forEach((s) => {
      doc.text(
        `${s.name || "-"} | Email: ${s.email || "-"} | Phone: ${
          s.phone || "-"
        } | Address: ${s.address || "-"} | Country: ${s.country || "-"}`
      );
    });

    doc.moveDown(0.8);
    doc.fontSize(12).text("Summary", { underline: true }).moveDown(0.3);
    doc.fontSize(11).text(`Total Suppliers: ${suppliers.length}`);

    doc.end();
  } catch (error) {
    console.error("Export suppliers PDF error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Server error" });
    }
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
