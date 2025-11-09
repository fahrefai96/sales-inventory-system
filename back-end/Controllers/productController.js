// back-end/Controllers/productController.js
import Category from "../models/Category.js";
import Brand from "../models/Brand.js";
import Product from "../models/Product.js";
import Supplier from "../models/Supplier.js";
import InventoryLog from "../models/InventoryLog.js";

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
      const beforeQty = 0; // treat restore as from 0
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

      // Log only if stock actually differs
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
 */
const getProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const { brand: brandId, code } = req.query;

    const q = {
      isDeleted: false,
      name: { $regex: search, $options: "i" },
    };

    if (brandId) q.brand = brandId;
    if (code) q.code = code;

    const products = await Product.find(q)
      .populate("category")
      .populate("brand")
      .populate("supplier");

    // Dropdown mode: used by your React AsyncSelect
    if (req.query.dropdown) {
      const dropdownOptions = products.map((p) => ({
        value: p._id,
        label: `${p.code} - ${p.name}`,
      }));
      return res.json(dropdownOptions);
    }

    const categories = await Category.find();
    const suppliers = await Supplier.find();
    // only active brands for UI
    const brands = await Brand.find({ active: true }).sort({ name: 1 });

    return res
      .status(200)
      .json({ success: true, products, categories, suppliers, brands });
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

export { addProduct, getProducts, updateProduct, deleteProduct };
