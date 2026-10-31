import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Thiếu MONGODB_URI trong file .env");
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log("MongoDB connected:", mongoose.connection.name);
}
