import Category from "../models/Category.js";
import Brand from "../models/Brand.js";
import Product from "../models/Product.js";
import Supplier from "../models/Supplier.js";

// Add a new product
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
    } = req.body;

    // base validations
    if (!code?.trim())
      return res
        .status(400)
        .json({ success: false, error: "Product code is required" });

    const codeExists = await Product.findOne({ code: code.trim() });
    if (codeExists)
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

    // size must be one of category.sizeOptions
    if (!size)
      return res
        .status(400)
        .json({ success: false, error: "Size is required" });
    if (!Array.isArray(cat.sizeOptions) || !cat.sizeOptions.includes(size)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid size for this category" });
    }

    const newProduct = await Product.create({
      name,
      description,
      code: code.trim(),
      price,
      stock,
      category,
      supplier,
      brand,
      size,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: newProduct,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// Get all products (with optional filters)
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

// Update a product
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
    // unique code except self
    const dup = await Product.findOne({ _id: { $ne: id }, code: code.trim() });
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

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        description,
        code: code.trim(),
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

    return res.status(200).json({ success: true, updatedProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    return res
      .status(500)
      .json({ success: false, error: "Server error " + error.message });
  }
};

// Soft delete a product
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

    // Mark deleted and bump lastUpdated; return the updated doc
    const updated = await Product.findByIdAndUpdate(
      id,
      { isDeleted: true, lastUpdated: new Date() },
      { new: true }
    );

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
