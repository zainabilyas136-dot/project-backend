import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { appError } from "../utils/errors.js";

async function recordMovement(
  product,
  type,
  quantity,
  previousStock,
  order,
  userId,
  session,
) {
  await StockMovement.create(
    [
      {
        product: product._id,
        type,
        quantity,
        previousStock,
        newStock: product.stockQuantity,
        referenceType: "SalesOrder",
        referenceId: order._id,
        createdBy: userId,
      },
    ],
    { session },
  );
}

export async function deductOrderStock(order, userId, session) {
  if (order.stockAdjusted)
    throw appError("Stock has already been deducted for this order", 409);
  for (const item of order.items) {
    const product = await Product.findById(item.product).session(session);
    if (!product || !product.isActive)
      throw appError("A product on this order is missing or inactive", 409);
    if (product.stockQuantity < item.quantity)
      throw appError(`Insufficient stock for ${product.name}`);
    const previousStock = product.stockQuantity;
    product.stockQuantity -= item.quantity;
    await product.save({ session });
    await recordMovement(
      product,
      "OUT",
      item.quantity,
      previousStock,
      order,
      userId,
      session,
    );
  }
  order.stockAdjusted = true;
  order.stockRestored = false;
}

export async function restoreOrderStock(order, userId, session) {
  if (!order.stockAdjusted) return false;
  if (order.stockRestored)
    throw appError("Stock has already been restored for this order", 409);
  for (const item of order.items) {
    const product = await Product.findById(item.product).session(session);
    if (!product)
      throw appError("A product on this order no longer exists", 409);
    const previousStock = product.stockQuantity;
    product.stockQuantity += item.quantity;
    await product.save({ session });
    await recordMovement(
      product,
      "IN",
      item.quantity,
      previousStock,
      order,
      userId,
      session,
    );
  }
  order.stockRestored = true;
  return true;
}
