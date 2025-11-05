import Category from "../models/Category.js";
import Product from "../models/Product.js";
import Supplier from "../models/Supplier.js";

// Add a new product
const addProduct = async (req, res) => {
  try {
    const { name, description, price, stock, category, supplier } = req.body;

    const newProduct = new Product({
      name,
      description,
      price,
      stock,
      category,
      supplier,
    });
    await newProduct.save();

    res
      .status(201)
      .json({ success: true, message: "Product created successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Get all products (with optional search for dropdown)
const getProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const products = await Product.find({
      isDeleted: false,
      name: { $regex: search, $options: "i" },
    }).populate("category").populate("supplier");

    if (req.query.dropdown) {
      // AsyncSelect wants an array of { value, label } objects
      const dropdownOptions = products.map((p) => ({
        value: p._id,
        label: p.name,
      }));
      return res.json(dropdownOptions);
    }

    const categories = await Category.find();
    const suppliers = await Supplier.find();
    res.status(200).json({ success: true, products, categories, suppliers });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error " + error.message });
  }
};

// Update a product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, category, supplier } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, error: "Product Not Found" });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { name, description, price, stock, category, supplier },
      { new: true }
    );

    res.status(200).json({ success: true, updatedProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ success: false, error: "Server error " + error.message });
  }
};

// Soft delete a product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    if (product.isDeleted) {
      return res.status(400).json({ success: false, error: "Product is already deleted" });
    }

    await Product.updateOne({ _id: id }, { isDeleted: true });
    res.status(200).json({ success: true, product });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ success: false, error: "Server error " + error.message });
  }
};

export { addProduct, getProducts, updateProduct, deleteProduct };