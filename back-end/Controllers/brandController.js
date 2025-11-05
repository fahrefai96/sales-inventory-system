import Brand from "../models/Brand.js";
import Product from "../models/Product.js";

export const createBrand = async (req, res) => {
  try {
    const { name, description, active = true } = req.body || {};
    if (!name?.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Brand name is required" });
    }

    const exists = await Brand.findOne({ name: name.trim() });
    if (exists) {
      return res
        .status(409)
        .json({ success: false, error: "Brand already exists" });
    }

    const brand = await Brand.create({
      name: name.trim(),
      description,
      active,
    });
    return res.status(201).json({ success: true, brand });
  } catch (err) {
    console.error("createBrand error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export const listBrands = async (_req, res) => {
  try {
    const brands = await Brand.find().sort({ name: 1 });
    return res.json({ success: true, brands });
  } catch (err) {
    console.error("listBrands error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, active } = req.body || {};
    const update = {};
    if (name) update.name = name.trim();
    if (description !== undefined) update.description = description;
    if (active !== undefined) update.active = !!active;

    // avoid duplicate names
    if (update.name) {
      const dup = await Brand.findOne({ _id: { $ne: id }, name: update.name });
      if (dup) {
        return res
          .status(409)
          .json({
            success: false,
            error: "Another brand with this name exists",
          });
      }
    }

    const brand = await Brand.findByIdAndUpdate(id, update, { new: true });
    if (!brand)
      return res.status(404).json({ success: false, error: "Brand not found" });
    return res.json({ success: true, brand });
  } catch (err) {
    console.error("updateBrand error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    // block deletion if products reference this brand
    const count = await Product.countDocuments({ brand: id, isDeleted: false });
    if (count > 0) {
      return res.status(400).json({
        success: false,
        error:
          "Cannot delete brand with associated products. Deactivate it or reassign products first.",
      });
    }

    const brand = await Brand.findByIdAndDelete(id);
    if (!brand)
      return res.status(404).json({ success: false, error: "Brand not found" });
    return res.json({ success: true, brand });
  } catch (err) {
    console.error("deleteBrand error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};
