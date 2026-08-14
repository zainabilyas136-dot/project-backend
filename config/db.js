import mongoose from "mongoose";
export async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.syncIndexes();
  console.log("MongoDB connected");
}
