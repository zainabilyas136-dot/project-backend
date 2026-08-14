export function adminOrSales(req, res, next) {
  if (!["admin", "sales"].includes(req.user?.role))
    return res
      .status(403)
      .json({ success: false, message: "Sales access required" });
  next();
}
