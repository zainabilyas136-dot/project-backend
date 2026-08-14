import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^$|^\S+@\S+\.\S+$/, "Enter a valid email address"],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      match: [/^$|^[0-9+()\-\s]{7,30}$/, "Enter a valid phone number"],
    },
    address: { type: String, trim: true, default: "", maxlength: 300 },
  },
  { timestamps: true },
);

customerSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $gt: "" } } },
);

export default mongoose.model("Customer", customerSchema);
