import Settings from "../models/Settings.js";

// Get general settings
export const getGeneralSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();

    // If no settings document exists, create one with default empty values
    if (!settings) {
      settings = new Settings({
        general: {
          businessName: "",
          address: "",
          phone: "",
          email: "",
          ownerName: "",
          logoUrl: "",
        },
      });
      await settings.save();
    }

    return res.json({
      success: true,
      general: settings.general || {},
    });
  } catch (error) {
    console.error("getGeneralSettings error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve settings",
    });
  }
};

// Update general settings
export const updateGeneralSettings = async (req, res) => {
  try {
    const { businessName, address, phone, email, ownerName, logoUrl } =
      req.body;

    // Find the single settings document, or create if it doesn't exist
    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings({
        general: {
          businessName: "",
          address: "",
          phone: "",
          email: "",
          ownerName: "",
          logoUrl: "",
        },
      });
    }

    // Update only the general section
    if (!settings.general) {
      settings.general = {};
    }

    if (businessName !== undefined) settings.general.businessName = businessName;
    if (address !== undefined) settings.general.address = address;
    if (phone !== undefined) settings.general.phone = phone;
    if (email !== undefined) settings.general.email = email;
    if (ownerName !== undefined) settings.general.ownerName = ownerName;
    if (logoUrl !== undefined) settings.general.logoUrl = logoUrl;

    await settings.save();

    return res.json({
      success: true,
      general: settings.general,
    });
  } catch (error) {
    console.error("updateGeneralSettings error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update settings",
    });
  }
};

