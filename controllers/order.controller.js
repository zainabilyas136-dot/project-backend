import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import SalesOrder from "../models/SalesOrder.js";
import {
  assertCustomer,
  calculateOrderTotals,
} from "../services/orderCalculation.service.js";
import {
  assertValidTransition,
  ORDER_STATUSES,
} from "../services/orderWorkflow.service.js";
import {
  deductOrderStock,
  restoreOrderStock,
} from "../services/stock.service.js";
import { appError } from "../utils/errors.js";
import { nextOrderNumber } from "../utils/order-number.js";
import {
  escapeRegex,
  parseDateRange,
  parsePagination,
} from "../utils/query.js";
import { runInTransaction } from "../utils/transaction.js";
import { sendOk, sendPaginated } from "../utils/response.js";

const populatedOrderPaths = [
  "customer",
  "createdBy",
  "items.product",
  "cancellation.requestedBy",
  "cancellation.reviewedBy",
];
const CANCELLATION_STATUSES = ["None", "Pending", "Approved", "Rejected"];
const CANCELLABLE_STATUSES = ["Confirmed", "Processing"];

async function populateOrder(order) {
  return order.populate(populatedOrderPaths);
}

function assertSalesOwnership(order, user, action) {
  if (user.role === "sales" && String(order.createdBy) !== String(user._id)) {
    throw appError(`You can only ${action} your own orders`, 403);
  }
}

function reviewNote(value) {
  return String(value || "")
    .trim()
    .slice(0, 500);
}

export async function createOrder(req, res) {
  const order = await runInTransaction(async (session) => {
    await assertCustomer(req.body.customer, session);
    const totals = await calculateOrderTotals(
      req.body.items,
      req.body.discount,
      { session, checkStock: true },
    );
    const [createdOrder] = await SalesOrder.create(
      [
        {
          orderNo: await nextOrderNumber(session),
          customer: req.body.customer,
          ...totals,
          status: "Draft",
          createdBy: req.user._id,
        },
      ],
      { session },
    );
    return createdOrder;
  });
  sendOk(res, await populateOrder(order), 201);
}

export async function listOrders(req, res) {
  const query = req.user.role === "sales" ? { createdBy: req.user._id } : {};
  if (req.query.status) {
    if (!ORDER_STATUSES.includes(req.query.status))
      throw appError("Invalid order status filter");
    query.status = req.query.status;
  }
  if (req.query.cancellationStatus) {
    if (!CANCELLATION_STATUSES.includes(req.query.cancellationStatus))
      throw appError("Invalid cancellation status filter");
    query["cancellation.status"] = req.query.cancellationStatus;
  }
  if (req.query.createdBy) {
    if (req.user.role === "sales")
      throw appError("Sales users can only view their own orders", 403);
    if (!mongoose.isValidObjectId(req.query.createdBy))
      throw appError("Created by must be a valid user id");
    query.createdBy = req.query.createdBy;
  }
  if (req.query.search) {
    const search = new RegExp(escapeRegex(req.query.search.trim()), "i");
    const customers = await Customer.find({
      $or: [{ name: search }, { email: search }, { phone: search }],
    }).select("_id");
    query.$or = [
      { orderNo: search },
      { customer: { $in: customers.map((customer) => customer._id) } },
    ];
  }
  Object.assign(query, parseDateRange(req.query));
  const { page, limit } = parsePagination(req.query, { limit: 10 });
  const [items, total] = await Promise.all([
    SalesOrder.find(query)
      .populate(populatedOrderPaths)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    SalesOrder.countDocuments(query),
  ]);
  sendPaginated(res, items, { page, limit, total });
}

export async function getOrder(req, res) {
  const order = await SalesOrder.findById(req.params.id).populate(
    populatedOrderPaths,
  );
  if (!order)
    return res.status(404).json({ success: false, message: "Order not found" });
  assertSalesOwnership(order, req.user, "view");
  sendOk(res, order);
}

export async function updateDraft(req, res) {
  const order = await SalesOrder.findById(req.params.id);
  if (!order)
    return res.status(404).json({ success: false, message: "Order not found" });
  if (order.status !== "Draft")
    throw appError("Only Draft orders can be edited");
  assertSalesOwnership(order, req.user, "edit");
  await assertCustomer(req.body.customer);
  const totals = await calculateOrderTotals(req.body.items, req.body.discount, {
    checkStock: true,
  });
  order.customer = req.body.customer;
  Object.assign(order, totals);
  await order.save();
  sendOk(res, await populateOrder(order));
}

export async function confirmOrder(req, res) {
  const savedOrder = await runInTransaction(async (session) => {
    const order = await SalesOrder.findById(req.params.id).session(session);
    if (!order) throw appError("Order not found", 404);
    if (order.status !== "Draft")
      throw appError("Only Draft orders can be confirmed");
    assertSalesOwnership(order, req.user, "confirm");
    if (order.stockAdjusted)
      throw appError("Stock has already been deducted for this order", 409);
    await assertCustomer(order.customer, session);
    const totals = await calculateOrderTotals(order.items, order.discount, {
      session,
      checkStock: true,
    });
    Object.assign(order, totals);
    await deductOrderStock(order, req.user._id, session);
    order.status = "Confirmed";
    await order.save({ session });
    return order;
  });
  sendOk(res, await populateOrder(savedOrder));
}

export async function setStatus(req, res) {
  const nextStatus = String(req.body.status || "");
  const expectedStatus = { Processing: "Confirmed", Completed: "Processing" }[
    nextStatus
  ];
  if (!expectedStatus)
    throw appError(`Invalid status transition to ${nextStatus}`);
  const updatedOrder = await SalesOrder.findOneAndUpdate(
    { _id: req.params.id, status: expectedStatus, stockAdjusted: true },
    { $set: { status: nextStatus } },
    { new: true, runValidators: true },
  );
  if (updatedOrder) return sendOk(res, await populateOrder(updatedOrder));

  const currentOrder = await SalesOrder.findById(req.params.id).select(
    "status stockAdjusted",
  );
  if (!currentOrder)
    return res.status(404).json({ success: false, message: "Order not found" });
  if (currentOrder.status === nextStatus)
    throw appError("Another request already changed this order", 409);
  if (
    currentOrder.status === "Cancelled" ||
    currentOrder.status === "Completed"
  )
    throw appError("Completed and Cancelled orders are terminal", 400);
  if (!currentOrder.stockAdjusted)
    throw appError("Order stock has not been deducted", 409);
  assertValidTransition(currentOrder.status, nextStatus);
}

export async function cancelDraftOrder(req, res) {
  const existing = await SalesOrder.findById(req.params.id).select(
    "status createdBy cancellation stockAdjusted",
  );
  if (!existing)
    return res.status(404).json({ success: false, message: "Order not found" });
  assertSalesOwnership(existing, req.user, "cancel");
  if (existing.status !== "Draft")
    throw appError("Only Draft orders can be directly cancelled");
  const cancelled = await SalesOrder.findOneAndUpdate(
    {
      _id: req.params.id,
      status: "Draft",
      "cancellation.status": { $ne: "Pending" },
    },
    {
      $set: {
        status: "Cancelled",
        cancelledBy: req.user._id,
        cancelledAt: new Date(),
        stockRestored: false,
        "cancellation.requested": false,
        "cancellation.requestedBy": null,
        "cancellation.requestedAt": null,
        "cancellation.reason": "",
        "cancellation.status": "None",
        "cancellation.reviewedBy": null,
        "cancellation.reviewedAt": null,
        "cancellation.reviewNote": "",
      },
    },
    { new: true, runValidators: true },
  );
  if (!cancelled)
    throw appError("Another request already changed this Draft order", 409);
  sendOk(res, await populateOrder(cancelled));
}

export async function requestCancellation(req, res) {
  const reason = String(req.body.reason || "").trim();
  if (!reason) throw appError("A cancellation reason is required");
  if (reason.length > 500)
    throw appError("Cancellation reason cannot exceed 500 characters");
  const order = await SalesOrder.findById(req.params.id);
  if (!order)
    return res.status(404).json({ success: false, message: "Order not found" });
  assertSalesOwnership(order, req.user, "request cancellation for");
  if (["Completed", "Cancelled"].includes(order.status))
    throw appError("This order cannot be cancelled");
  if (order.status === "Draft")
    throw appError("Draft orders must be directly cancelled");
  if (!CANCELLABLE_STATUSES.includes(order.status))
    throw appError("Cancellation is not allowed in the current state");
  const requested = await SalesOrder.findOneAndUpdate(
    {
      _id: req.params.id,
      status: { $in: CANCELLABLE_STATUSES },
      "cancellation.status": { $ne: "Pending" },
      ...(req.user.role === "sales" ? { createdBy: req.user._id } : {}),
    },
    {
      $set: {
        "cancellation.requested": true,
        "cancellation.requestedBy": req.user._id,
        "cancellation.requestedAt": new Date(),
        "cancellation.reason": reason,
        "cancellation.status": "Pending",
        "cancellation.reviewedBy": null,
        "cancellation.reviewedAt": null,
        "cancellation.reviewNote": "",
      },
    },
    { new: true, runValidators: true },
  );
  if (requested) return sendOk(res, await populateOrder(requested));
  const current = await SalesOrder.findById(req.params.id).select(
    "status createdBy cancellation",
  );
  if (!current)
    return res.status(404).json({ success: false, message: "Order not found" });
  if (
    req.user.role === "sales" &&
    String(current.createdBy) !== String(req.user._id)
  ) {
    return res
      .status(403)
      .json({
        success: false,
        message: "You can only request cancellation for your own orders",
      });
  }
  if (current.cancellation?.status === "Pending")
    throw appError("A cancellation request is already pending", 409);
  if (["Completed", "Cancelled"].includes(current.status))
    throw appError("This order cannot be cancelled");
  throw appError("Another request already changed the order state", 409);
}

export async function approveCancellation(req, res) {
  const savedOrder = await runInTransaction(async (session) => {
    const order = await SalesOrder.findById(req.params.id).session(session);
    if (!order) throw appError("Order not found", 404);
    if (order.cancellation?.status !== "Pending")
      throw appError("No pending cancellation request exists");
    if (["Completed", "Cancelled"].includes(order.status))
      throw appError("This order cannot be cancelled");
    if (
      ["Confirmed", "Processing"].includes(order.status) &&
      !order.stockAdjusted
    )
      throw appError("This order has no recorded stock deduction", 409);
    if (order.stockAdjusted && !order.stockRestored)
      await restoreOrderStock(order, req.user._id, session);
    order.status = "Cancelled";
    order.cancelledBy = req.user._id;
    order.cancelledAt = new Date();
    order.cancellation.status = "Approved";
    order.cancellation.reviewedBy = req.user._id;
    order.cancellation.reviewedAt = new Date();
    order.cancellation.reviewNote = reviewNote(req.body.reviewNote);
    await order.save({ session });
    return order;
  });
  sendOk(res, await populateOrder(savedOrder));
}

export async function rejectCancellation(req, res) {
  const order = await SalesOrder.findById(req.params.id);
  if (!order)
    return res.status(404).json({ success: false, message: "Order not found" });
  if (order.cancellation?.status !== "Pending")
    throw appError("No pending cancellation request exists");
  if (["Completed", "Cancelled"].includes(order.status))
    throw appError("This cancellation request cannot be reviewed");
  order.cancellation.status = "Rejected";
  order.cancellation.reviewedBy = req.user._id;
  order.cancellation.reviewedAt = new Date();
  order.cancellation.reviewNote = reviewNote(req.body.reviewNote);
  await order.save();
  sendOk(res, await populateOrder(order));
}
