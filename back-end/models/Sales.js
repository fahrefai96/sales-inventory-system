import mongoose from "mongoose";
const saleSchema = new mongoose.Schema(
  {
    saleId: {
      type: String,
      unique: true,
      required: true,
    },

    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
      },
    ],

    totalAmount: { type: Number, required: true, min: 0 },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // who last updated the sale (optional until first edit)
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    createdAt: { type: Date, default: Date.now },

    // Added saleDate
    saleDate: {
      type: Date,
      default: Date.now,
      required: true,
    },

    // Add discount field (percentage discount, default to 0%)
    discount: {
      type: Number,
      default: 0,
    },

    // Discounted total amount
    discountedAmount: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid", "partial"],
      default: "paid",
    },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
  },
  {
    //  automatic updatedAt
    timestamps: true,
  }
);

saleSchema.pre("save", function (next) {
  // prefer discountedAmount if present, else grandTotal
  const baseTotal = Number(
    this.discountedAmount != null ? this.discountedAmount : this.grandTotal || 0
  );

  // initialize on create if not set
  if (this.isNew) {
    if (this.amountPaid == null) {
      // default: fully paid if paymentStatus is "paid", else 0
      this.amountPaid = this.paymentStatus === "paid" ? baseTotal : 0;
    }
  }

  // recompute amountDue and status every save
  const paid = Number(this.amountPaid || 0);
  this.amountDue = Math.max(0, baseTotal - paid);

  if (this.amountDue === 0) this.paymentStatus = "paid";
  else if (paid > 0) this.paymentStatus = "partial";
  else this.paymentStatus = "unpaid";

  next();
});
saleSchema.index({ customer: 1, createdAt: -1 });

const Sale = mongoose.model("Sale", saleSchema);
export default Sale;
