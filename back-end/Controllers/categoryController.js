import Category from "../models/Category.js";
import Product from "../models/Product.js";

const FIXED_SIZES = ["Small", "Medium", "Large"];

// Add category
const addCategory = async (req, res) => {
  try {
    const {
      formCategory,
      formDescription,
      sizeMode = "fixed",
      sizeOptions = [],
    } = req.body;

    const existingCategory = await Category.findOne({ name: formCategory });
    if (existingCategory) {
      return res
        .status(400)
        .json({ success: false, error: "Category already exists" });
    }

    let finalOptions = [];
    if (sizeMode === "fixed") {
      finalOptions = FIXED_SIZES;
    } else if (sizeMode === "custom") {
      if (!Array.isArray(sizeOptions) || sizeOptions.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Provide at least one size for custom mode",
        });
      }
      finalOptions = sizeOptions.map((s) => String(s).trim()).filter(Boolean);
      if (finalOptions.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Custom size list cannot be empty" });
      }
    }

    const category = await Category.create({
      name: formCategory,
      description: formDescription,
      sizeMode,
      sizeOptions: finalOptions,
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const getCategorys = async (req, res) => {
  try {
    const categories = await Category.find();
    return res.status(200).json({ success: true, categories });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: "Server error " + error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      formCategory,
      formDescription,
      sizeMode = "fixed",
      sizeOptions = [],
    } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, error: "Category Not Found" });
    }

    let finalOptions = [];
    if (sizeMode === "fixed") {
      finalOptions = FIXED_SIZES;
    } else if (sizeMode === "custom") {
      if (!Array.isArray(sizeOptions) || sizeOptions.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Provide at least one size for custom mode",
        });
      }
      finalOptions = sizeOptions.map((s) => String(s).trim()).filter(Boolean);
      if (finalOptions.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Custom size list cannot be empty" });
      }
    }

    const updateCategory = await Category.findByIdAndUpdate(
      id,
      {
        name: formCategory,
        description: formDescription,
        sizeMode,
        sizeOptions: finalOptions,
      },
      { new: true }
    );

    res.status(200).json({ success: true, updateCategory });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: "Server error " + error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const activeCount = await Product.countDocuments({
      category: id,
      isDeleted: false,
    });
    if (activeCount > 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete category with associated (active) products",
      });
    }

    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, error: "document not found" });
    }
    res.status(200).json({ success: true, category });
  } catch (error) {
    console.error("Error editing category:", error);
    res
      .status(500)
      .json({ success: false, error: "Server error " + error.message });
  }
};

export { addCategory, getCategorys, updateCategory, deleteCategory };
