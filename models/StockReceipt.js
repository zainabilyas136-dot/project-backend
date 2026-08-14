import mongoose from "mongoose";

const receiptItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    costPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const stockReceiptSchema = new mongoose.Schema(
  {
    referenceNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    supplierName: { type: String, required: true, trim: true, maxlength: 160 },
    items: {
      type: [receiptItemSchema],
      required: true,
      validate: (value) => value.length > 0,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receivedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

export default mongoose.model("StockReceipt", stockReceiptSchema);
