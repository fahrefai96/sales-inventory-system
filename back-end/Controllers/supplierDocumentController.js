import mongoose from "mongoose";
import Supplier from "../models/Supplier.js";
import SupplierDocument from "../models/SupplierDocument.js";
import multer from "multer";

// Configure multer for memory storage (we'll store in MongoDB)
const storage = multer.memoryStorage();

// File filter - only allow specific file types
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Allowed: PDF, Images (JPG, PNG, GIF), Word, Excel"
      ),
      false
    );
  }
};

// Multer configuration
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// POST /api/supplier/:id/documents
export const uploadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentType, description } = req.body;
    const file = req.file;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "User not authenticated" });
    }

    if (!file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid supplier ID format" });
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, error: "Supplier not found" });
    }

    // Validate document type
    const validTypes = ["invoice", "contract", "import_document", "other"];
    const docType = validTypes.includes(documentType) ? documentType : "other";

    // Generate unique filename
    const fileExtension = file.originalname.split(".").pop();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const uniqueFileName = `${timestamp}_${randomStr}.${fileExtension}`;

    const document = await SupplierDocument.create({
      supplierId: id,
      documentType: docType,
      fileName: uniqueFileName,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      fileData: file.buffer,
      description: description || "",
      uploadedBy: userId,
    });

    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      document: {
        _id: document._id,
        supplierId: document.supplierId,
        documentType: document.documentType,
        fileName: document.fileName,
        originalFileName: document.originalFileName,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        description: document.description,
        uploadedBy: document.uploadedBy,
        uploadedAt: document.uploadedAt,
      },
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    if (error.message.includes("Invalid file type")) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res
      .status(500)
      .json({ success: false, error: "Failed to upload document" });
  }
};

// GET /api/supplier/:id/documents
export const getDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentType } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid supplier ID format" });
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, error: "Supplier not found" });
    }

    const query = { supplierId: id };
    if (documentType) {
      query.documentType = documentType;
    }

    const documents = await SupplierDocument.find(query)
      .select("-fileData") // Don't send file data in list
      .populate("uploadedBy", "name email")
      .sort({ uploadedAt: -1 })
      .lean();

    return res.json({
      success: true,
      supplier: {
        _id: supplier._id,
        name: supplier.name,
      },
      totalDocuments: documents.length,
      documents,
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch documents" });
  }
};

// GET /api/supplier/:id/documents/:docId
export const downloadDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;

    // Set CORS headers for all responses (success and error)
    const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
    res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(docId)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid ID format" });
    }

    const document = await SupplierDocument.findOne({
      _id: docId,
      supplierId: id,
    });

    if (!document) {
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    }

    // Set file download headers
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(document.originalFileName)}"`
    );
    res.setHeader("Content-Length", document.fileSize);

    res.send(document.fileData);
  } catch (error) {
    console.error("Error downloading document:", error);
    // Ensure CORS headers are set even on error
    const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
    res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    return res
      .status(500)
      .json({ success: false, error: "Failed to download document" });
  }
};

// DELETE /api/supplier/:id/documents/:docId
export const deleteDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(docId)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid ID format" });
    }

    const document = await SupplierDocument.findOneAndDelete({
      _id: docId,
      supplierId: id,
    });

    if (!document) {
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    }

    return res.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to delete document" });
  }
};

