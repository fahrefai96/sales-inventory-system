import mongoose from "mongoose";

const supplierDocumentSchema = new mongoose.Schema({
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
    required: true,
    index: true,
  },
  documentType: {
    type: String,
    required: true,
    enum: ["invoice", "contract", "import_document", "other"],
    default: "other",
  },
  fileName: {
    type: String,
    required: true,
    trim: true,
  },
  originalFileName: {
    type: String,
    required: true,
    trim: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  fileData: {
    type: Buffer,
    required: true,
  },
  description: {
    type: String,
    trim: true,
    default: "",
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

supplierDocumentSchema.index({ supplierId: 1, uploadedAt: -1 });
supplierDocumentSchema.index({ documentType: 1 });

const SupplierDocument = mongoose.model("SupplierDocument", supplierDocumentSchema);
export default SupplierDocument;

