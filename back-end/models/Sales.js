import mongoose from "mongoose";

// NEW: individual payment / adjustment entries
const paymentEntrySchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
    },
    note: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["payment", "adjustment"],
      default: "payment",
    },
    // Payment method for individual payments (optional)
    method: {
      type: String,
      enum: ["cash", "cheque"],
      default: undefined,
    },
    // Optional cheque fields for individual payments
    chequeNumber: {
      type: String,
    },
    chequeDate: {
      type: Date,
    },
    chequeBank: {
      type: String,
    },
    chequeStatus: {
      type: String,
      enum: ["pending", "cleared", "bounced"],
      default: "pending",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { _id: false }
);

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
      default: "unpaid",
    },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },

    paymentMethod: {
      type: String,
      enum: ["cash", "cheque"],
      default: "cash",
    },

    chequeNumber: String,
    chequeDate: Date,
    chequeBank: String,
    chequeStatus: {
      type: String,
      enum: ["pending", "cleared", "bounced"],
      default: "pending",
    },

    // payment history (normal payments + admin adjustments)
    payments: [paymentEntrySchema],

    // Return total amount
    returnTotal: {
      type: Number,
      default: 0,
    },

    // Returned items
    returns: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: { type: Number, required: true },
        amount: { type: Number, required: true }, // value of this returned portion
        reason: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    //  automatic updatedAt
    timestamps: true,
  }
);

saleSchema.pre("save", function (next) {
  // Calculate baseTotal: prefer discountedAmount, else totalAmount, else 0
  const baseTotal = Number(this.discountedAmount ?? this.totalAmount ?? 0);
  const returnTotal = Number(this.returnTotal || 0);

  // Initialize on create if not set
  if (this.isNew) {
    // For new sales, explicitly set amountPaid to 0
    if (this.amountPaid == null) {
      this.amountPaid = 0;
    }
  }

  // Recompute amountDue and status every save
  const paid = Number(this.amountPaid || 0);
  this.amountDue = Math.max(0, baseTotal - paid);

  // Set paymentStatus based on amountPaid and amountDue
  // Special case: If all goods are returned (baseTotal === 0 after returns) and no payments were ever made,
  // don't mark as "paid" - keep as "unpaid"
  // Check if there were any payments by looking at payments array length
  const hasPayments = Array.isArray(this.payments) && this.payments.length > 0;
  
  if (this.amountDue === 0) {
    // If baseTotal is 0 due to returns and no payments were ever made, keep as unpaid
    if (baseTotal === 0 && returnTotal > 0 && !hasPayments && paid === 0) {
      this.paymentStatus = "unpaid";
    } else {
      // Otherwise, if amountDue is 0, it's paid (either fully paid or refunded after payment)
      this.paymentStatus = "paid";
    }
  } else if (paid > 0 && this.amountDue > 0) {
    this.paymentStatus = "partial";
  } else {
    this.paymentStatus = "unpaid";
  }

  next();
});

saleSchema.index({ customer: 1, createdAt: -1 });

const Sale = mongoose.model("Sale", saleSchema);
export default Sale;
