import StockMovement from "../models/StockMovement.js";
import mongoose from "mongoose";
import { appError } from "../utils/errors.js";
import { parsePagination } from "../utils/query.js";
import { sendPaginated } from "../utils/response.js";

export async function listMovements(req, res) {
  const query = {};
  if (req.query.product) {
    if (!mongoose.isValidObjectId(req.query.product))
      throw appError("Invalid product id");
    query.product = req.query.product;
  }
  if (req.query.type) {
    if (!["IN", "OUT", "ADJUSTMENT"].includes(req.query.type))
      throw appError("Invalid movement type");
    query.type = req.query.type;
  }
  const { page, limit } = parsePagination(req.query, { limit: 25 });
  const [items, total] = await Promise.all([
    StockMovement.find(query)
      .populate("product createdBy")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    StockMovement.countDocuments(query),
  ]);
  sendPaginated(res, items, { page, limit, total });
}
