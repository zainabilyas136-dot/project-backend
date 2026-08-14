import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { connectDB } from "./config/db.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";
import indexRoutes from "./routes/index.routes.js";
import { sendOk } from "./utils/response.js";

dotenv.config();

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
  app.use(express.json({ limit: "1mb" }));
  app.get("/", (req, res) =>
    sendOk(res, { message: "Project 5 API is running" }),
  );
  app.use("/api", indexRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export async function startServer() {
  await connectDB();
  const port = process.env.PORT || 5000;
  const app = createApp();
  return app.listen(port, () => console.log(`Server running on ${port}`));
}

if (process.env.NODE_ENV !== "test") await startServer();

export default createApp;
