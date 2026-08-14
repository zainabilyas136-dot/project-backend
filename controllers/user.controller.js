import User from "../models/User.js";
import { appError } from "../utils/errors.js";
import { escapeRegex, parseBoolean, parsePagination } from "../utils/query.js";
import { sendOk, sendPaginated } from "../utils/response.js";

const USER_ROLES = ["sales", "warehouse", "admin"];

export async function listUsers(req, res) {
  const query = {};
  if (req.query.search) {
    const search = new RegExp(escapeRegex(req.query.search.trim()), "i");
    query.$or = [{ name: search }, { email: search }];
  }
  if (req.query.role !== undefined) {
    if (!USER_ROLES.includes(req.query.role))
      throw appError("Invalid role filter");
    query.role = req.query.role;
  }
  const active = parseBoolean(req.query.isActive, "isActive");
  if (active !== undefined) query.isActive = active;
  const { page, limit } = parsePagination(req.query, { limit: 10 });
  const [items, total] = await Promise.all([
    User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(query),
  ]);
  sendPaginated(res, items, { page, limit, total });
}

export async function createUser(req, res) {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body.password || "");
  const { role } = req.body;
  if (!name || !email || !password)
    throw appError("Name, email and password are required");
  if (!USER_ROLES.includes(role))
    return res.status(400).json({ success: false, message: "Invalid role" });
  if (await User.exists({ email }))
    throw appError("Email already exists.", 409);
  const user = await User.create({ name, email, password, role });
  sendOk(
    res,
    {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
    201,
  );
}

export async function updateUser(req, res) {
  const updates = {};
  for (const field of ["name", "role", "isActive"])
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  if (updates.role && !USER_ROLES.includes(updates.role))
    return res.status(400).json({ success: false, message: "Invalid role" });
  if (updates.isActive !== undefined && typeof updates.isActive !== "boolean")
    throw appError("isActive must be true or false");
  if (
    String(req.params.id) === String(req.user._id) &&
    updates.isActive === false
  )
    return res
      .status(400)
      .json({
        success: false,
        message: "You cannot deactivate your own account",
      });
  const existing = await User.findById(req.params.id);
  if (!existing)
    return res.status(404).json({ success: false, message: "User not found" });
  const removesActiveAdmin =
    existing.role === "admin" &&
    existing.isActive &&
    (updates.isActive === false ||
      updates.role === "sales" ||
      updates.role === "warehouse");
  if (
    removesActiveAdmin &&
    (await User.countDocuments({ role: "admin", isActive: true })) <= 1
  )
    throw appError("The final active admin cannot be removed", 400);
  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  }).select("-password");
  sendOk(res, user);
}
