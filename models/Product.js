import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    sellingPrice: { type: Number, required: true, min: 0 },
    stockQuantity: { type: Number, default: 0, min: 0, index: true },
    reorderLevel: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

productSchema.index({ name: "text", sku: "text" });
productSchema.index({ stockQuantity: 1, reorderLevel: 1 });

export default mongoose.model("Product", productSchema);
