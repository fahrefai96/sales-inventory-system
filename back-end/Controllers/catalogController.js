import PDFDocument from "pdfkit";
import Category from "../models/Category.js";
import Brand from "../models/Brand.js";
import { getBusinessInfo, addBusinessHeader } from "../utils/pdfHelpers.js";

const pipeDoc = (res, filename) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  doc.on("error", (err) => {
    console.error("PDF error:", err);
    try {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "PDF generation failed" });
      }
      doc.destroy();
    } catch {}
  });
  doc.pipe(res);
  return doc;
};

export const exportCatalogPdf = async (req, res) => {
  try {
    // Set CORS headers explicitly before any response
    const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
    res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    
    const { type = "categories", search } = req.query; // type: 'categories' | 'brands'
    
    if (type === "categories") {
      const query = {};
      if (search && search.trim()) {
        query.name = { $regex: search.trim(), $options: "i" };
      }
      
      const categories = await Category.find(query)
        .sort({ name: 1 })
        .lean();
      
      const doc = pipeDoc(res, `catalog_categories_${new Date().toISOString().slice(0, 10)}.pdf`);
      
      // Fetch and add business information header
      const businessInfo = await getBusinessInfo();
      addBusinessHeader(doc, businessInfo);
      
      doc.fontSize(16).text("Categories Report", { align: "left" }).moveDown(0.3);
      doc
        .fontSize(10)
        .text(
          `Generated: ${new Date().toLocaleString("en-LK", {
            timeZone: "Asia/Colombo",
          })}`
        );
      if (search) doc.text(`Search: ${search}`);
      doc.moveDown(0.8);
      
      doc.fontSize(12).text("Categories", { underline: true });
      doc.moveDown(0.3).fontSize(10);
      
      if (categories.length === 0) {
        doc.text("No categories found.");
      } else {
        categories.forEach((c) => {
          const sizes = (c.sizeOptions || []).join(", ") || "—";
          doc.text(`${c.name || "—"} | Sizes: ${sizes}`);
        });
      }
      
      doc.moveDown(0.8);
      doc.fontSize(12).text("Summary", { underline: true }).moveDown(0.3);
      doc.fontSize(11).text(`Total Categories: ${categories.length}`);
      
      doc.end();
    } else if (type === "brands") {
      const query = {};
      if (search && search.trim()) {
        query.name = { $regex: search.trim(), $options: "i" };
      }
      
      const brands = await Brand.find(query)
        .sort({ name: 1 })
        .lean();
      
      const doc = pipeDoc(res, `catalog_brands_${new Date().toISOString().slice(0, 10)}.pdf`);
      
      // Fetch and add business information header
      const businessInfo = await getBusinessInfo();
      addBusinessHeader(doc, businessInfo);
      
      doc.fontSize(16).text("Brands Report", { align: "left" }).moveDown(0.3);
      doc
        .fontSize(10)
        .text(
          `Generated: ${new Date().toLocaleString("en-LK", {
            timeZone: "Asia/Colombo",
          })}`
        );
      if (search) doc.text(`Search: ${search}`);
      doc.moveDown(0.8);
      
      doc.fontSize(12).text("Brands", { underline: true });
      doc.moveDown(0.3).fontSize(10);
      
      if (brands.length === 0) {
        doc.text("No brands found.");
      } else {
        brands.forEach((b) => {
          const active = b.active !== false ? "Yes" : "No";
          doc.text(`${b.name || "—"} | Active: ${active}`);
        });
      }
      
      doc.moveDown(0.8);
      doc.fontSize(12).text("Summary", { underline: true }).moveDown(0.3);
      doc.fontSize(11).text(`Total Brands: ${brands.length}`);
      
      doc.end();
    } else {
      return res.status(400).json({ success: false, error: "Invalid type. Use 'categories' or 'brands'" });
    }
  } catch (error) {
    console.error("Export catalog PDF error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
};

