import { Router } from "express";
import * as controller from "../../controllers/user.controller.js";
import { adminOnly } from "../../middlewares/admin.middleware.js";
import { protect } from "../../middlewares/protect.middleware.js";
import { validateObjectId } from "../../middlewares/validateObjectId.middleware.js";

const router = Router();
router.use(protect, adminOnly);
router.get("/", controller.listUsers);
router.post("/", controller.createUser);
router.patch("/:id", validateObjectId, controller.updateUser);
export default router;
