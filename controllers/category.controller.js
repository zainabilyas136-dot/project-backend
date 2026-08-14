import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { appError } from "../utils/errors.js";
import { parseBoolean, parsePagination, escapeRegex } from "../utils/query.js";
import { sendOk, sendPaginated } from "../utils/response.js";

const CATEGORY_FIELDS = ["name", "description", "isActive"];

export async function listCategories(req, res) {
  const query = {};
  if (req.query.search)
    query.name = new RegExp(escapeRegex(req.query.search.trim()), "i");
  const active = parseBoolean(req.query.isActive, "isActive");
  if (active !== undefined) query.isActive = active;
  const { page, limit } = parsePagination(req.query, { limit: 10 });
  const [items, total] = await Promise.all([
    Category.find(query)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Category.countDocuments(query),
  ]);
  sendPaginated(res, items, { page, limit, total });
}

export async function listCategoryOptions(req, res) {
  const active =
    req.query.isActive === undefined
      ? true
      : parseBoolean(req.query.isActive, "isActive");
  const query = active === undefined ? {} : { isActive: active };
  sendOk(res, await Category.find(query).sort({ name: 1 }));
}

export async function createCategory(req, res) {
  const data = {
    name: req.body.name,
    description: req.body.description,
    isActive: req.body.isActive,
  };
  const name = String(data.name || "").trim();
  if (await Category.exists({ name }))
    throw appError("Category name already exists.", 409);
  sendOk(res, await Category.create(data), 201);
}

export async function updateCategory(req, res) {
  const updates = {};
  for (const field of CATEGORY_FIELDS) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.name !== undefined) {
    updates.name = String(updates.name).trim();
    if (
      await Category.exists({ name: updates.name, _id: { $ne: req.params.id } })
    )
      throw appError("Category name already exists.", 409);
  }
  const category = await Category.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!category)
    return res
      .status(404)
      .json({ success: false, message: "Category not found" });
  sendOk(res, category);
}

export async function deleteCategory(req, res) {
  if (await Product.exists({ category: req.params.id }))
    throw appError(
      "Category is still used by products; deactivate it instead",
      409,
    );
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category)
    return res
      .status(404)
      .json({ success: false, message: "Category not found" });
  sendOk(res, { message: "Category deleted" });
}
