import { Router } from "express";
import { listMovements } from "../../controllers/stockMovement.controller.js";
import { adminOrWarehouse } from "../../middlewares/adminOrWarehouse.middleware.js";
import { protect } from "../../middlewares/protect.middleware.js";

const router = Router();
router.get("/", protect, adminOrWarehouse, listMovements);
export default router;
