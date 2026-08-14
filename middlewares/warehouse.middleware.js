export function warehouseOnly(req, res, next) {
  if (req.user?.role !== "warehouse")
    return res
      .status(403)
      .json({ success: false, message: "Warehouse staff access required" });
  next();
}
