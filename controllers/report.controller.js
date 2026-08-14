import Product from "../models/Product.js";
import SalesOrder from "../models/SalesOrder.js";
import StockMovement from "../models/StockMovement.js";
import { parseDateRange } from "../utils/query.js";
import { sendOk } from "../utils/response.js";

function salesDateFilter(query) {
  return parseDateRange(query);
}

export async function dashboard(req, res) {
  const own = req.user.role === "sales" ? { createdBy: req.user._id } : {};
  const orderMatch = { ...own };
  const [
    totalProducts,
    totalOrders,
    lowStockCount,
    lowStockProducts,
    totalSales,
    completedOrders,
    draftOrders,
    confirmedOrders,
    processingOrders,
    recent,
    byStatus,
  ] = await Promise.all([
    Product.countDocuments({ isActive: true }),
    SalesOrder.countDocuments(orderMatch),
    Product.countDocuments({
      isActive: true,
      $expr: { $lte: ["$stockQuantity", "$reorderLevel"] },
    }),
    Product.find({
      isActive: true,
      $expr: { $lte: ["$stockQuantity", "$reorderLevel"] },
    })
      .populate("category")
      .sort({ stockQuantity: 1 })
      .limit(8),
    SalesOrder.aggregate([
      {
        $match: {
          ...orderMatch,
          status: { $in: ["Confirmed", "Processing", "Completed"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    SalesOrder.countDocuments({ ...orderMatch, status: "Completed" }),
    SalesOrder.countDocuments({ ...orderMatch, status: "Draft" }),
    SalesOrder.countDocuments({ ...orderMatch, status: "Confirmed" }),
    SalesOrder.countDocuments({ ...orderMatch, status: "Processing" }),
    SalesOrder.find(orderMatch)
      .populate("customer createdBy")
      .sort({ createdAt: -1 })
      .limit(5),
    SalesOrder.aggregate([
      { $match: orderMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  sendOk(res, {
    cards: {
      totalProducts,
      lowStockProducts: lowStockCount,
      totalOrders,
      totalSales: totalSales[0]?.total || 0,
      completedOrders,
      draftOrders,
      confirmedOrders,
      processingOrders,
    },
    lowStock: lowStockProducts,
    recent,
    byStatus,
  });
}

export async function salesReport(req, res) {
  const match = {
    status: { $in: ["Confirmed", "Processing", "Completed"] },
    ...salesDateFilter(req.query),
  };
  const [totals, topSelling, completedOrders] = await Promise.all([
    SalesOrder.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          orders: { $sum: 1 },
          sales: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    SalesOrder.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          quantity: { $sum: "$items.quantity" },
          sales: { $sum: "$items.subtotal" },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
    ]),
    SalesOrder.countDocuments({ ...match, status: "Completed" }),
  ]);
  sendOk(res, { totals, topSelling, completedOrders });
}

export async function inventoryReport(req, res) {
  const [
    totalProducts,
    stock,
    lowStock,
    outOfStock,
    byCategory,
    recentMovements,
  ] = await Promise.all([
    Product.countDocuments({ isActive: true }),
    Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: "$stockQuantity" } } },
    ]),
    Product.find({
      isActive: true,
      $expr: { $lte: ["$stockQuantity", "$reorderLevel"] },
    })
      .populate("category")
      .sort({ stockQuantity: 1 }),
    Product.find({ isActive: true, stockQuantity: 0 })
      .populate("category")
      .sort({ name: 1 }),
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$category",
          products: { $sum: 1 },
          stock: { $sum: "$stockQuantity" },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
    ]),
    StockMovement.find()
      .populate("product createdBy")
      .sort({ createdAt: -1 })
      .limit(20),
  ]);
  sendOk(res, {
    totalProducts,
    totalStockQuantity: stock[0]?.total || 0,
    lowStock,
    outOfStock,
    byCategory,
    recentMovements,
  });
}
