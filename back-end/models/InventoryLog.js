import mongoose from "mongoose";

const inventoryLogSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "sale.create",
        "sale.update.restore",
        "sale.update.apply",
        "sale.delete.restore",
        "sale.return",
        "product.create",
        "product.update",
        "product.restore",
        "product.delete",
        "stock.adjust",
        "purchase.post",
        "purchase.cancel",
      ],
      required: true,
    },
    delta: { type: Number, required: true }, // - for out, + for in
    beforeQty: { type: Number, required: true },
    afterQty: { type: Number, required: true },

    // Optional links for context
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
    note: { type: String },

    // Who did it
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

inventoryLogSchema.index({ product: 1, createdAt: -1 });
inventoryLogSchema.index({ action: 1, createdAt: -1 });
inventoryLogSchema.index({ actor: 1, createdAt: -1 });
inventoryLogSchema.index({ sale: 1 });

const InventoryLog = mongoose.model("InventoryLog", inventoryLogSchema);
export default InventoryLog;
