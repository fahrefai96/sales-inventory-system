import Customer from "../models/Customer.js";
import Sale from "../models/Sales.js";

// Add customer
export const addCustomer = async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, error: "Name is required" });

    const newCustomer = new Customer({ name, email, phone, address });
    await newCustomer.save();

    res.status(201).json({
      success: true,
      message: "Customer added successfully",
      customer: newCustomer,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Get customers
export const getCustomers = async (req, res) => {
  try {
    const search = req.query.search || "";
    const customers = await Customer.find({
      name: { $regex: search, $options: "i" },
    });
    res.json({ success: true, customers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Update customer
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address } = req.body;

    const updated = await Customer.findByIdAndUpdate(
      id,
      { name, email, phone, address },
      { new: true }
    );
    if (!updated)
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });

    res.json({ success: true, message: "Customer updated", customer: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Delete customer
export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Customer.findByIdAndDelete(id);
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });

    res.json({ success: true, message: "Customer deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// GET /api/customers/:id/purchases
export const getCustomerPurchases = async (req, res) => {
  try {
    const { id } = req.params;

    // make sure the customer exists
    const customer = await Customer.findById(id);
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });
    }

    // find sales linked to this customer, newest first
    const purchases = await Sale.find({ customer: id })
      .populate("products.product", "name code price") // product details for each line item
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      customer,
      purchases,
    });
  } catch (error) {
    console.error("getCustomerPurchases error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};
