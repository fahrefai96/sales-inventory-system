import Settings from "../models/Settings.js";

/**
 * Fetch business information from Settings
 * Returns business info with defaults if not set
 */
export const getBusinessInfo = async () => {
  try {
    const settings = await Settings.findOne().lean();
    const general = settings?.general || {};
    
    return {
      businessName: general.businessName || "A2R Ceramic & Hardware",
      address: general.address || "",
      phone: general.phone || "+94-xxx-xxx-xxxx",
      email: general.email || "info@a2r.local",
      ownerName: general.ownerName || "",
      logoUrl: general.logoUrl || "",
    };
  } catch (error) {
    console.error("Error fetching business info:", error);
    // Return defaults on error
    return {
      businessName: "A2R Ceramic & Hardware",
      address: "",
      phone: "+94-xxx-xxx-xxxx",
      email: "info@a2r.local",
      ownerName: "",
      logoUrl: "",
    };
  }
};

/**
 * Add business information header to a PDF document
 * @param {PDFDocument} doc - The PDFKit document
 * @param {Object} businessInfo - Business information object
 */
export const addBusinessHeader = (doc, businessInfo) => {
  const { businessName, address, phone, email, logoUrl } = businessInfo;
  
  // Business Name (main header)
  doc
    .fontSize(18)
    .text(businessName || "A2R Ceramic & Hardware", { align: "left" })
    .moveDown(0.3);
  
  // Address (if provided)
  if (address) {
    doc.fontSize(10).text(address, { align: "left" });
  }
  
  // Contact information
  const contactParts = [];
  if (phone) contactParts.push(`Tel: ${phone}`);
  if (email) contactParts.push(`Email: ${email}`);
  
  if (contactParts.length > 0) {
    doc.fontSize(10).text(contactParts.join("  |  "), { align: "left" });
  }
  
  doc.moveDown(1);
  
  return doc;
};

