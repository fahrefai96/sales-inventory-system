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

export const listBrands = async (req, res) => {
  try {
    const {
      search = "",
      page = "1",
      limit = "25",
      sortBy = "name", // "name" | "active" | "createdAt"
      sortDir = "asc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 25));
    const sortDirNum = sortDir === "asc" ? 1 : -1;

    // Build query
    const q = {};
    if (search && search.trim()) {
      q.name = { $regex: search.trim(), $options: "i" };
    }

    // Build sort
    const sort = {};
    if (sortBy === "active") sort.active = sortDirNum;
    else if (sortBy === "createdAt") sort.createdAt = sortDirNum;
    else sort.name = sortDirNum; // default: name

    // Get total count
    const total = await Brand.countDocuments(q);

    // Get paginated results
    const skip = (pageNum - 1) * limitNum;
    const brands = await Brand.find(q)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    return res.json({
      success: true,
      brands,
      total,
      page: pageNum,
      limit: limitNum,
    });
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
