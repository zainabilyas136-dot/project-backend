import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import StockReceipt from "../models/StockReceipt.js";
import { appError } from "../utils/errors.js";
import {
  escapeRegex,
  parseDateRange,
  parsePagination,
} from "../utils/query.js";
import { runInTransaction } from "../utils/transaction.js";
import { sendOk, sendPaginated } from "../utils/response.js";

function normalizeItems(items) {
  const productIds = new Set();
  return items.map((item) => {
    if (!item?.product || !mongoose.isValidObjectId(item.product)) {
      throw appError("Every receipt item must reference a valid product");
    }
    if (productIds.has(String(item.product)))
      throw appError("Each product may appear only once per receipt");

    const quantity = Number(item.quantity);
    const costPrice = Number(item.costPrice);
    if (!Number.isInteger(quantity) || quantity < 1)
      throw appError("Receipt quantities must be positive whole numbers");
    if (!Number.isFinite(costPrice) || costPrice < 0)
      throw appError("Cost price must be zero or greater");

    productIds.add(String(item.product));
    return { product: item.product, quantity, costPrice };
  });
}

function parseReceivedAt(value) {
  const receivedDate = value ? new Date(value) : new Date();
  if (Number.isNaN(receivedDate.getTime()))
    throw appError("Received date is invalid");
  if (receivedDate > new Date(Date.now() + 5 * 60 * 1000))
    throw appError("Received date cannot be in the future");
  return receivedDate;
}

export async function createReceipt(req, res) {
  const referenceNo = String(req.body.referenceNo || "").trim();
  const supplierName = String(req.body.supplierName || "").trim();
  const { items, receivedAt } = req.body;
  if (
    !referenceNo ||
    !supplierName ||
    !Array.isArray(items) ||
    items.length === 0
  )
    throw appError(
      "Reference number, supplier name and at least one item are required",
    );

  const cleanItems = normalizeItems(items);
  const receivedDate = parseReceivedAt(receivedAt);

  const receipt = await runInTransaction(async (session) => {
    if (await StockReceipt.exists({ referenceNo }).session(session))
      throw appError("Reference number already exists.", 409);
    const products = [];
    for (const item of cleanItems) {
      const product = await Product.findById(item.product).session(session);
      if (!product || !product.isActive)
        throw appError("Product must exist and be active", product ? 400 : 404);
      products.push({ item, product });
    }
    const [createdReceipt] = await StockReceipt.create(
      [
        {
          referenceNo,
          supplierName,
          items: cleanItems,
          receivedAt: receivedDate,
          receivedBy: req.user._id,
        },
      ],
      { session },
    );
    for (const { item, product } of products) {
      const previousStock = product.stockQuantity;
      product.stockQuantity += item.quantity;
      await product.save({ session });
      await StockMovement.create(
        [
          {
            product: product._id,
            type: "IN",
            quantity: item.quantity,
            previousStock,
            newStock: product.stockQuantity,
            referenceType: "StockReceipt",
            referenceId: createdReceipt._id,
            createdBy: req.user._id,
          },
        ],
        { session },
      );
    }
    return createdReceipt;
  });

  sendOk(res, await receipt.populate("items.product receivedBy"), 201);
}

export async function listReceipts(req, res) {
  const query = {};
  if (req.query.search) {
    const search = new RegExp(escapeRegex(req.query.search.trim()), "i");
    query.$or = [{ supplierName: search }, { referenceNo: search }];
  }
  if (req.query.supplier)
    query.supplierName = new RegExp(
      escapeRegex(req.query.supplier.trim()),
      "i",
    );
  if (req.query.referenceNo)
    query.referenceNo = new RegExp(
      escapeRegex(req.query.referenceNo.trim()),
      "i",
    );
  Object.assign(query, parseDateRange(req.query, "receivedAt"));
  const { page, limit } = parsePagination(req.query, { limit: 10 });
  const [items, total] = await Promise.all([
    StockReceipt.find(query)
      .populate("items.product receivedBy")
      .sort({ receivedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    StockReceipt.countDocuments(query),
  ]);
  sendPaginated(res, items, { page, limit, total });
}
