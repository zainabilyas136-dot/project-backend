import { Router } from "express";
import * as controller from "../../controllers/report.controller.js";
import { adminOnly } from "../../middlewares/admin.middleware.js";
import { protect } from "../../middlewares/protect.middleware.js";

const router = Router();
router.get("/dashboard", protect, controller.dashboard);
router.get("/sales", protect, adminOnly, controller.salesReport);
router.get("/inventory", protect, adminOnly, controller.inventoryReport);
export default router;
