import { Router } from "express";
import {
  createReceipt,
  listReceipts,
} from "../../controllers/stockReceipt.controller.js";
import { adminOrWarehouse } from "../../middlewares/adminOrWarehouse.middleware.js";
import { protect } from "../../middlewares/protect.middleware.js";

const router = Router();
router.use(protect, adminOrWarehouse);
router.post("/", createReceipt);
router.get("/", listReceipts);
export default router;
