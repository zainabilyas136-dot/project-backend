export function adminOrWarehouse(req, res, next) {
  if (!["admin", "warehouse"].includes(req.user?.role))
    return res
      .status(403)
      .json({ success: false, message: "Warehouse access required" });
  next();
}
