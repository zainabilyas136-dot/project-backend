const duplicateMessages = {
  sku: "SKU already exists.",
  orderNo: "Order number already exists.",
  referenceNo: "Reference number already exists.",
  email: "Email already exists.",
  name: "Name already exists.",
};

export function notFound(req, res) {
  res
    .status(404)
    .json({ success: false, message: `Route not found: ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    const field = fields[0];
    return res.status(409).json({
      success: false,
      message:
        duplicateMessages[field] || "A record with that value already exists.",
      fields: err.keyValue,
    });
  }
  if (
    err?.code === 20 ||
    err?.message?.includes("Transaction numbers are only allowed")
  ) {
    return res
      .status(503)
      .json({
        success: false,
        message: "MongoDB transactions require a replica set member or mongos",
      });
  }
  if (err?.name === "CastError") {
    return res
      .status(400)
      .json({ success: false, message: `Invalid ${err.path || "value"}` });
  }
  if (err?.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((item) => item.message)
      .join(" ");
    return res.status(400).json({ success: false, message });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  const message =
    status < 500 || process.env.NODE_ENV !== "production"
      ? err.message
      : "Server error";
  res
    .status(status)
    .json({ success: false, message: message || "Server error" });
}
