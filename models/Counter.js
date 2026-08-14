import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    sequence: { type: Number, required: true, default: 1000, min: 0 },
  },
  { timestamps: true },
);

export default mongoose.model("Counter", counterSchema);
