import { appError } from "./errors.js";

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parsePagination(query, defaults = {}) {
  const defaultPage = defaults.page || 1;
  const defaultLimit = defaults.limit || 10;
  const rawPage = query.page === undefined ? defaultPage : Number(query.page);
  const rawLimit =
    query.limit === undefined ? defaultLimit : Number(query.limit);
  if (!Number.isInteger(rawPage) || rawPage < 1)
    throw appError("Page must be a positive whole number");
  if (!Number.isInteger(rawLimit) || rawLimit < 1)
    throw appError("Limit must be a positive whole number");
  return { page: rawPage, limit: Math.min(100, rawLimit) };
}

export function parseDateRange(query, field = "createdAt") {
  if (!query.from && !query.to) return {};
  const range = {};
  if (query.from) {
    const from = new Date(`${query.from}T00:00:00.000Z`);
    if (Number.isNaN(from.getTime())) throw appError("From date is invalid");
    range.$gte = from;
  }
  if (query.to) {
    const to = new Date(`${query.to}T23:59:59.999Z`);
    if (Number.isNaN(to.getTime())) throw appError("To date is invalid");
    range.$lte = to;
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte)
    throw appError("From date cannot be after to date");
  return { [field]: range };
}

export function parseBoolean(value, field) {
  if (value === undefined) return undefined;
  if (value !== "true" && value !== "false")
    throw appError(`${field} must be true or false`);
  return value === "true";
}
