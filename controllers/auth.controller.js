import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendOk } from "../utils/response.js";

function createToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}

export async function login(req, res) {
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(req.body.password || "")))
    return res
      .status(401)
      .json({ success: false, message: "Invalid credentials" });
  if (!user.isActive)
    return res
      .status(401)
      .json({ success: false, message: "This account is inactive" });
  sendOk(res, { token: createToken(user._id), user: publicUser(user) });
}

export function me(req, res) {
  sendOk(res, { user: req.user });
}
