function plainValue(value) {
  return value && typeof value.toObject === "function"
    ? value.toObject()
    : value;
}

export function sendOk(res, payload, status = 200) {
  const value = plainValue(payload);
  if (Array.isArray(value))
    return res.status(status).json({ success: true, items: value });
  if (value && typeof value === "object")
    return res.status(status).json({ success: true, ...value });
  return res.status(status).json({ success: true, data: value });
}

export function sendPaginated(
  res,
  items,
  { page, limit, total },
  status = 200,
) {
  return sendOk(
    res,
    {
      data: items,
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    },
    status,
  );
}
