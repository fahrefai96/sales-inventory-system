import Supplier from "../models/Supplier.js";
import Product from "../models/Product.js";

// Route to add a new employee
const addSupplier = async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;

    // Check if user already exists with the same email
    let existingSupplier = await Supplier.findOne({ email });
    if (existingSupplier) {
      return res
        .status(400)
        .json({ success: false, error: "Supplier already exists" });
    }

    // Hash the password before storing the user
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newSupplier = new Supplier({
      name,
      email,
      phone,
      address,
    });
    const supplier = await newSupplier.save();

    res
      .status(201)
      .json({ success: true, message: "Supplier created successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find();
    res.status(201).json({ success: true, suppliers });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: "Server error " + error.message });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address } = req.body;

    const supplier = await Supplier.findById({ _id: id });
    if (!supplier) {
      res.status(404).json({ success: false, error: "Supplier Not Found" });
    }

    const updateUser = await Supplier.findByIdAndUpdate(
      { _id: id },
      { name, email, phone, address }
    );

    res.status(201).json({ success: true, updateUser });
  } catch (error) {
    console.error("Error editing employee:", error);
    res
      .status(500)
      .json({ success: false, error: "Server error " + error.message });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const productCount = await Product.countDocuments({ supplier: id });
    if (productCount > 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Cannot delete supplier with associated products",
        });
    }

    const supplier = await Supplier.findByIdAndDelete({ _id: id });
    if (!supplier) {
      res
        .status(404)
        .json({ success: false, error: "document not found " + error.message });
    }
    res.status(201).json({ success: true, supplier });
  } catch (error) {
    console.error("Error editing employee:", error);
    res
      .status(500)
      .json({ success: false, error: "Server error " + error.message });
  }
};

export { addSupplier, getSuppliers, updateSupplier, deleteSupplier };
