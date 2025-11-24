// back-end/Controllers/productController.js
import Category from "../models/Category.js";
import Brand from "../models/Brand.js";
import Product from "../models/Product.js";
import Supplier from "../models/Supplier.js";
import InventoryLog from "../models/InventoryLog.js";
import Settings from "../models/Settings.js";
import PDFDocument from "pdfkit";
import { getBusinessInfo, addBusinessHeader } from "../utils/pdfHelpers.js";

const writeInventoryLog = async ({
  productId,
  action,
  beforeQty,
  afterQty,
  userId,
}) => {
  const b = Number(beforeQty || 0);
  const a = Number(afterQty || 0);
  const delta = a - b;
  if (delta === 0) return; // only log if stock actually changed
  await InventoryLog.create({
    product: productId,
    action, // e.g., "product.create", "product.update.stock", "product.delete", "product.restore"
    delta, // + added, - removed
    beforeQty: b,
    afterQty: a,
    actor: userId || null,
  });
};

/**
 * Add a new product (or restore if a soft-deleted product with the same code exists)
 */
const addProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      stock,
      category,
      supplier,
      brand,
      size,
      code,
    } = req.body || {};

    // ---- Basic validations ----
    if (!code?.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Product code is required" });
    }
    if (!name?.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Product name is required" });
    }
    const trimmedCode = code.trim();

    // Price (allow 0, but not negative / NaN)
    const priceNum = Number(price ?? 0);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      return res
        .status(400)
        .json({ success: false, error: "Price must be a non-negative number" });
    }

    // Stock defaults to 0 if not provided
    const initialStock = Number(stock ?? 0);
    if (Number.isNaN(initialStock) || initialStock < 0) {
      return res
        .status(400)
        .json({ success: false, error: "Stock must be a non-negative number" });
    }

    // Validate refs
    const cat = await Category.findById(category);
    if (!cat) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid category" });
    }

    const br = await Brand.findById(brand);
    if (!br || br.active === false) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or inactive brand" });
    }

    const sup = await Supplier.findById(supplier);
    if (!sup) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid supplier" });
    }

    // Size must match category.sizeOptions (if defined)
    if (!size) {
      return res
        .status(400)
        .json({ success: false, error: "Size is required" });
    }
    if (!Array.isArray(cat.sizeOptions) || !cat.sizeOptions.includes(size)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid size for this category" });
    }

    // ---- Duplicates by code ----
    // Active duplicate?
    const activeDup = await Product.findOne({
      code: trimmedCode,
      isDeleted: false,
    }).lean();
    if (activeDup) {
      return res
        .status(409)
        .json({ success: false, error: "Product code already exists" });
    }

    // Soft-deleted duplicate? Restore instead of create
    const deletedMatch = await Product.findOne({
      code: trimmedCode,
      isDeleted: true,
    });

    if (deletedMatch) {
      if (req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error:
            "This product code belongs to a deleted product. Ask an admin to restore it.",
        });
      }

      const beforeQty = 0;
      deletedMatch.isDeleted = false;
      deletedMatch.name = name;
      deletedMatch.description = description;
      deletedMatch.price = priceNum;
      deletedMatch.stock = initialStock;
      deletedMatch.category = category;
      deletedMatch.supplier = supplier;
      deletedMatch.brand = brand;
      deletedMatch.size = size;
      deletedMatch.lastUpdated = new Date();

      await deletedMatch.save();

      await writeInventoryLog({
        productId: deletedMatch._id,
        action: "product.restore",
        beforeQty,
        afterQty: Number(deletedMatch.stock || 0),
        userId: req.user?._id,
      });

      return res.status(200).json({
        success: true,
        message: "Restored previously deleted product",
        product: deletedMatch,
      });
    }
    // ---- Create new product ----
    const newProduct = await Product.create({
      name,
      description,
      code: trimmedCode,
      price: priceNum,
      stock: initialStock, // default 0 if not provided
      category,
      supplier,
      brand,
      size,
      avgCost: 0,
      lastCost: 0,
    });

    // Inventory log (0 -> initialStock)
    await writeInventoryLog({
      productId: newProduct._id,
      action: "product.create",
      beforeQty: 0,
      afterQty: Number(newProduct.stock || 0),
      userId: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: newProduct,
    });
  } catch (error) {
    console.error("Error adding product:", error);
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ success: false, error: "Product code already exists" });
    }
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * Get all products (with optional filters); supports dropdown mode
 * Query params:
 *  - search: search by name or code
 *  - brand: filter by brand ID
 *  - category: filter by category ID
 *  - stock: filter by stock status (all, low, out, in)
 *  - code: exact code match
 *  - sortBy: field to sort by (code, name, price, stock, lastUpdated)
 *  - sortDir: asc | desc
 *  - page: page number (default: 1)
 *  - limit: items per page (default: 25)
 *  - dropdown: if true, returns dropdown format
 */
const getProducts = async (req, res) => {
  try {
    const {
      search = "",
      brand: brandId,
      category: categoryId,
      supplier: supplierId,
      stock: stockFilter,
      code,
      sortBy = "lastUpdated",
      sortDir = "desc",
      page = 1,
      limit = 25,
      dropdown,
    } = req.query;

    const q = {
      isDeleted: false,
    };

    // Search by name or code
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      q.$or = [
        { name: searchRegex },
        { code: searchRegex },
      ];
    }

    // Filters
    if (brandId) q.brand = brandId;
    if (categoryId) q.category = categoryId;
    if (supplierId) q.supplier = supplierId;
    if (code) q.code = code;

    // Stock filter - get threshold from Settings
    if (stockFilter && stockFilter !== "all") {
      let lowStockThreshold = 5; // default
      try {
        const settings = await Settings.findOne().lean();
        if (settings?.inventory?.lowStockThreshold != null) {
          lowStockThreshold = Number(settings.inventory.lowStockThreshold);
        }
      } catch (error) {
        console.error("Error fetching low stock threshold from settings:", error);
      }

      if (stockFilter === "low") {
        q.stock = { $gt: 0, $lt: lowStockThreshold };
      } else if (stockFilter === "out") {
        q.stock = 0;
      } else if (stockFilter === "in") {
        q.stock = { $gte: lowStockThreshold };
      }
    }

    // Sorting
    const validSortFields = {
      code: "code",
      name: "name",
      price: "price",
      stock: "stock",
      lastUpdated: "lastUpdated",
    };
    const sortField = validSortFields[sortBy] || "lastUpdated";
    const sortDirection = sortDir === "asc" ? 1 : -1;
    const sortObj = { [sortField]: sortDirection, _id: -1 }; // stable tiebreaker

    // Dropdown mode: used by your React AsyncSelect (no pagination)
    if (dropdown) {
    const products = await Product.find(q)
      .populate("category")
      .populate("brand")
        .populate("supplier")
        .sort(sortObj)
        .limit(500); // reasonable limit for dropdowns

      const dropdownOptions = products.map((p) => ({
        value: p._id,
        label: `${p.code} - ${p.name}`,
      }));
      return res.json(dropdownOptions);
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await Product.countDocuments(q);

    // Get paginated products
    const products = await Product.find(q)
      .populate("category")
      .populate("brand")
      .populate("supplier")
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.max(1, Math.ceil(total / limitNum));

    // Get metadata (categories, suppliers, brands) - only on first page or when needed
    const categories = await Category.find();
    const suppliers = await Supplier.find();
    const brands = await Brand.find({ active: true }).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      products,
      categories,
      suppliers,
      brands,
      total,
      page: pageNum,
      totalPages,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: "Server error " + error.message });
  }
};

/**
 * Update a product
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      stock,
      category,
      supplier,
      brand,
      size,
      code,
    } = req.body;

    const product = await Product.findById(id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, error: "Product Not Found" });

    if (!code?.trim())
      return res
        .status(400)
        .json({ success: false, error: "Product code is required" });

    const trimmedCode = code.trim();

    // Unique code among ACTIVE products (ignore self)
    const dup = await Product.findOne({
      _id: { $ne: id },
      code: trimmedCode,
      isDeleted: false,
    }).lean();
    if (dup)
      return res
        .status(409)
        .json({ success: false, error: "Product code already exists" });

    const cat = await Category.findById(category);
    if (!cat)
      return res
        .status(400)
        .json({ success: false, error: "Invalid category" });

    const br = await Brand.findById(brand);
    if (!br || br.active === false) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or inactive brand" });
    }

    const sup = await Supplier.findById(supplier);
    if (!sup)
      return res
        .status(400)
        .json({ success: false, error: "Invalid supplier" });

    if (!size)
      return res
        .status(400)
        .json({ success: false, error: "Size is required" });
    if (!Array.isArray(cat.sizeOptions) || !cat.sizeOptions.includes(size)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid size for this category" });
    }

    // INVENTORY LOG: capture stock BEFORE update
    const beforeQty = Number(product.stock);

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        description,
        code: trimmedCode,
        price,
        stock,
        category,
        supplier,
        brand,
        size,
        lastUpdated: new Date(),
      },
      { new: true }
    );

    // INVENTORY LOG: write only if stock actually changed
    await writeInventoryLog({
      productId: updatedProduct._id,
      action: "stock.adjust",
      beforeQty,
      afterQty: Number(updatedProduct.stock),
      userId: req.user?._id,
    });

    return res.status(200).json({ success: true, updatedProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ success: false, error: "Product code already exists" });
    }
    return res
      .status(500)
      .json({ success: false, error: "Server error " + error.message });
  }
};

/**
 * Soft delete a product
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate existence first
    const existing = await Product.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }

    if (existing.isDeleted) {
      // Already soft-deleted; return current state (idempotent)
      return res.status(200).json({
        success: true,
        product: existing,
        message: "Product already deleted",
      });
    }

    // INVENTORY LOG: capture stock BEFORE deletion
    const beforeQty = Number(existing.stock) || 0;

    // Mark deleted and bump lastUpdated; return the updated doc
    const updated = await Product.findByIdAndUpdate(
      id,
      { isDeleted: true, lastUpdated: new Date() },
      { new: true }
    );

    // INVENTORY LOG: deleting a product (stock -> 0)
    await writeInventoryLog({
      productId: existing._id,
      action: "product.delete",
      beforeQty,
      afterQty: 0,
      userId: req.user?._id,
    });

    return res.status(200).json({ success: true, product: updated });
  } catch (error) {
    if (error?.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, error: "Invalid product id" });
    }
    console.error("Error deleting product:", error);
    return res
      .status(500)
      .json({ success: false, error: "Server error " + error.message });
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

const money = (n) => Number(Number(n || 0).toFixed(2));

export const exportProductsCsv = async (req, res) => {
  try {
    const { search, category, brand, stock } = req.query;
    const query = { isDeleted: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }
    if (category && category !== "all") {
      query.category = category;
    }
    if (brand && brand !== "all") {
      query.brand = brand;
    }
    
    // Stock filter - get threshold from Settings
    if (stock && stock !== "all") {
      let lowStockThreshold = 5; // default
      try {
        const settings = await Settings.findOne().lean();
        if (settings?.inventory?.lowStockThreshold != null) {
          lowStockThreshold = Number(settings.inventory.lowStockThreshold);
        }
      } catch (error) {
        console.error("Error fetching low stock threshold from settings:", error);
      }

      if (stock === "low") {
        query.stock = { $gt: 0, $lt: lowStockThreshold };
      } else if (stock === "out") {
        query.stock = 0;
      } else if (stock === "in") {
        query.stock = { $gte: lowStockThreshold };
      }
    }

    const products = await Product.find(query)
      .select("code name price stock category brand supplier")
      .populate("category", "name")
      .populate("brand", "name")
      .populate("supplier", "name")
      .sort({ lastUpdated: -1 })
      .lean();

    const rows = products.map((p) => ({
      code: p.code || "-",
      name: p.name || "-",
      category: p.category?.name || "-",
      brand: p.brand?.name || "-",
      supplier: p.supplier?.name || "-",
      price: money(p.price || 0),
      stock: Number(p.stock || 0),
    }));

    sendCsv(
      res,
      `products_${new Date().toISOString().slice(0, 10)}.csv`,
      ["code", "name", "category", "brand", "supplier", "price", "stock"],
      rows
    );
  } catch (error) {
    console.error("Export products CSV error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

export const exportProductsPdf = async (req, res) => {
  try {
    const { search, category, brand, stock } = req.query;
    const query = { isDeleted: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }
    if (category && category !== "all") {
      query.category = category;
    }
    if (brand && brand !== "all") {
      query.brand = brand;
    }
    // Stock filter - get threshold from Settings
    if (stock && stock !== "all") {
      let lowStockThreshold = 5; // default
      try {
        const settings = await Settings.findOne().lean();
        if (settings?.inventory?.lowStockThreshold != null) {
          lowStockThreshold = Number(settings.inventory.lowStockThreshold);
        }
      } catch (error) {
        console.error("Error fetching low stock threshold from settings:", error);
      }

      if (stock === "low") {
        query.stock = { $gt: 0, $lt: lowStockThreshold };
      } else if (stock === "out") {
        query.stock = 0;
      } else if (stock === "in") {
        query.stock = { $gte: lowStockThreshold };
      }
    }

    const products = await Product.find(query)
      .select("code name price stock category brand supplier")
      .populate("category", "name")
      .populate("brand", "name")
      .populate("supplier", "name")
      .sort({ lastUpdated: -1 })
      .lean();

    const doc = pipeDoc(res, `products_${new Date().toISOString().slice(0, 10)}.pdf`);
    
    // Fetch and add business information header
    const businessInfo = await getBusinessInfo();
    addBusinessHeader(doc, businessInfo);
    
    doc.fontSize(16).text("Products Report", { align: "left" }).moveDown(0.3);
    doc
      .fontSize(10)
      .text(
        `Generated: ${new Date().toLocaleString("en-LK", {
          timeZone: "Asia/Colombo",
        })}`
      );
    doc.moveDown(0.8);

    doc.fontSize(12).text("Products", { underline: true });
    doc.moveDown(0.3).fontSize(10);

    let totalValue = 0;
    products.forEach((p) => {
      const value = money((p.price || 0) * (p.stock || 0));
      totalValue += value;
      doc.text(
        `${p.code || "-"} | ${p.name || "-"} | Category: ${
          p.category?.name || "-"
        } | Brand: ${p.brand?.name || "-"} | Supplier: ${
          p.supplier?.name || "-"
        } | Price: Rs. ${money(p.price || 0)} | Stock: ${
          p.stock || 0
        } | Value: Rs. ${money(value)}`
      );
    });

    doc.moveDown(0.8);
    doc.fontSize(12).text("Summary", { underline: true }).moveDown(0.3);
    doc.fontSize(11).text(`Total Products: ${products.length}`);
    doc.fontSize(11).text(`Total Stock Value: Rs. ${money(totalValue)}`);

    doc.end();
  } catch (error) {
    console.error("Export products PDF error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
};

export { addProduct, getProducts, updateProduct, deleteProduct };
