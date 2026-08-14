import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";
import { appError } from "../utils/errors.js";
import { roundMoney } from "../utils/money.js";

function findProduct(productId, session) {
  const query = Product.findById(productId);
  if (session) query.session(session);
  return query;
}

function collectQuantities(rawItems) {
  const quantities = new Map();
  for (const rawItem of rawItems) {
    if (!rawItem?.product || !mongoose.isValidObjectId(rawItem.product)) {
      throw appError("Every order row must reference a valid product");
    }
    const quantity = Number(rawItem.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw appError("Quantity must be a positive whole number");
    }
    const productId = String(rawItem.product);
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }
  return quantities;
}

export async function assertCustomer(customerId, session) {
  if (!mongoose.isValidObjectId(customerId))
    throw appError("A valid customer is required");
  const query = Customer.findById(customerId);
  if (session) query.session(session);
  if (!(await query)) throw appError("Customer not found", 404);
}

export async function calculateOrderTotals(
  rawItems,
  discount = 0,
  { session, checkStock = false } = {},
) {
  if (!Array.isArray(rawItems) || rawItems.length === 0)
    throw appError("At least one item is required");

  const quantities = collectQuantities(rawItems);

  const items = [];
  let subtotal = 0;
  for (const [productId, quantity] of quantities) {
    const product = await findProduct(productId, session);
    if (!product || !product.isActive)
      throw appError("Invalid or inactive product", product ? 400 : 404);
    if (checkStock && product.stockQuantity < quantity)
      throw appError(`Insufficient stock for ${product.name}`);
    const lineSubtotal = roundMoney(quantity * product.sellingPrice);
    subtotal += lineSubtotal;
    items.push({
      product: product._id,
      quantity,
      unitPrice: roundMoney(product.sellingPrice),
      subtotal: lineSubtotal,
    });
  }

  subtotal = roundMoney(subtotal);
  const cleanDiscount = Number(
    discount === undefined || discount === "" ? 0 : discount,
  );
  if (!Number.isFinite(cleanDiscount) || cleanDiscount < 0)
    throw appError("Discount must be zero or greater");
  const roundedDiscount = roundMoney(cleanDiscount);
  if (roundedDiscount > subtotal)
    throw appError("Discount cannot exceed subtotal");
  return {
    items,
    subtotal,
    discount: roundedDiscount,
    total: roundMoney(subtotal - roundedDiscount),
  };
}
