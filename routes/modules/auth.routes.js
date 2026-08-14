import { Router } from "express";
import { login, me } from "../../controllers/auth.controller.js";
import { protect } from "../../middlewares/protect.middleware.js";

const router = Router();
router.post("/login", login);
router.get("/me", protect, me);

export default router;
