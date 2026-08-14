import mongoose from "mongoose";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { appError } from "../utils/errors.js";
import { escapeRegex, parseBoolean, parsePagination } from "../utils/query.js";
import { sendOk, sendPaginated } from "../utils/response.js";

async function assertCategory(categoryId) {
  if (!mongoose.isValidObjectId(categoryId))
    throw appError("A valid category is required");
  if (!(await Category.exists({ _id: categoryId })))
    throw appError("Category not found", 404);
}

export async function listProducts(req, res) {
  const { search = "", category, isActive, lowStock } = req.query;
  const query = {};
  if (search) {
    const safeSearch = new RegExp(escapeRegex(search.trim()), "i");
    query.$or = [{ name: safeSearch }, { sku: safeSearch }];
  }
  if (category) query.category = category;
  const active = parseBoolean(isActive, "isActive");
  if (active !== undefined) query.isActive = active;
  if (lowStock !== undefined) {
    if (lowStock !== "true" && lowStock !== "false")
      throw appError("lowStock must be true or false");
    if (lowStock === "true")
      query.$expr = { $lte: ["$stockQuantity", "$reorderLevel"] };
  }
  const { page: safePage, limit: safeLimit } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    Product.find(query)
      .populate("category")
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    Product.countDocuments(query),
  ]);
  sendPaginated(res, items, { page: safePage, limit: safeLimit, total });
}

export async function getProduct(req, res) {
  const product = await Product.findById(req.params.id).populate("category");
  if (!product)
    return res
      .status(404)
      .json({ success: false, message: "Product not found" });
  sendOk(res, product);
}

export async function createProduct(req, res) {
  const productData = {};
  for (const field of [
    "sku",
    "name",
    "category",
    "sellingPrice",
    "reorderLevel",
    "isActive",
  ]) {
    if (req.body[field] !== undefined) productData[field] = req.body[field];
  }
  productData.sku = String(productData.sku || "")
    .trim()
    .toUpperCase();
  if (!productData.sku) throw appError("SKU is required");
  if (await Product.exists({ sku: productData.sku }))
    throw appError("SKU already exists.", 409);
  await assertCategory(productData.category);
  sendOk(res, await Product.create(productData), 201);
}

export async function updateProduct(req, res) {
  const updates = {};
  for (const field of [
    "sku",
    "name",
    "category",
    "sellingPrice",
    "reorderLevel",
    "isActive",
  ]) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.sku !== undefined) {
    updates.sku = String(updates.sku).trim().toUpperCase();
    if (await Product.exists({ sku: updates.sku, _id: { $ne: req.params.id } }))
      throw appError("SKU already exists.", 409);
  }
  if (updates.category !== undefined) await assertCategory(updates.category);
  const product = await Product.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  }).populate("category");
  if (!product)
    return res
      .status(404)
      .json({ success: false, message: "Product not found" });
  sendOk(res, product);
}

export async function deleteProduct(req, res) {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true },
  );
  if (!product)
    return res
      .status(404)
      .json({ success: false, message: "Product not found" });
  sendOk(res, { message: "Product deactivated", product });
}
