import Customer from "../models/Customer.js";
import SalesOrder from "../models/SalesOrder.js";
import { appError } from "../utils/errors.js";
import { escapeRegex, parsePagination } from "../utils/query.js";
import { sendOk, sendPaginated } from "../utils/response.js";

const CUSTOMER_FIELDS = ["name", "email", "phone", "address"];

export async function listCustomers(req, res) {
  const search = String(req.query.search || "").trim();
  const safeSearch = search ? new RegExp(escapeRegex(search), "i") : null;
  const query = safeSearch
    ? {
        $or: [
          { name: safeSearch },
          { email: safeSearch },
          { phone: safeSearch },
        ],
      }
    : {};
  const { page, limit } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    Customer.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Customer.countDocuments(query),
  ]);
  sendPaginated(res, items, { page, limit, total });
}

export async function getCustomer(req, res) {
  const customer = await Customer.findById(req.params.id);
  if (!customer)
    return res
      .status(404)
      .json({ success: false, message: "Customer not found" });
  const orderQuery = { customer: customer._id };
  if (req.user.role === "sales") orderQuery.createdBy = req.user._id;
  const orders = await SalesOrder.find(orderQuery)
    .populate("createdBy")
    .sort({ createdAt: -1 });
  sendOk(res, { customer, orders });
}

export async function createCustomer(req, res) {
  const data = {
    name: String(req.body.name || "").trim(),
    email: String(req.body.email || "")
      .trim()
      .toLowerCase(),
    phone: String(req.body.phone || "").trim(),
    address: String(req.body.address || "").trim(),
  };
  if (data.email && (await Customer.exists({ email: data.email })))
    throw appError("A customer with this email already exists", 409);
  sendOk(res, await Customer.create(data), 201);
}

export async function updateCustomer(req, res) {
  const updates = {};
  for (const field of CUSTOMER_FIELDS) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.name !== undefined) updates.name = String(updates.name).trim();
  if (updates.email !== undefined) {
    updates.email = String(updates.email).trim().toLowerCase();
    if (
      updates.email &&
      (await Customer.exists({
        email: updates.email,
        _id: { $ne: req.params.id },
      }))
    )
      throw appError("A customer with this email already exists", 409);
  }
  if (updates.phone !== undefined) updates.phone = String(updates.phone).trim();
  if (updates.address !== undefined)
    updates.address = String(updates.address).trim();
  const customer = await Customer.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!customer)
    return res
      .status(404)
      .json({ success: false, message: "Customer not found" });
  sendOk(res, customer);
}

export async function deleteCustomer(req, res) {
  if (await SalesOrder.exists({ customer: req.params.id }))
    return res
      .status(409)
      .json({ success: false, message: "Customer has order history" });
  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer)
    return res
      .status(404)
      .json({ success: false, message: "Customer not found" });
  sendOk(res, { message: "Customer deleted" });
}
