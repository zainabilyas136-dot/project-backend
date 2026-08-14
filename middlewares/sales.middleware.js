export function salesOnly(req, res, next) {
  if (req.user?.role !== "sales")
    return res
      .status(403)
      .json({ success: false, message: "Sales staff access required" });
  next();
}
