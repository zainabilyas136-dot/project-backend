import { Router } from "express";
import * as controller from "../../controllers/order.controller.js";
import { adminOnly } from "../../middlewares/admin.middleware.js";
import { adminOrSales } from "../../middlewares/adminOrSales.middleware.js";
import { adminOrWarehouse } from "../../middlewares/adminOrWarehouse.middleware.js";
import { protect } from "../../middlewares/protect.middleware.js";
import { validateObjectId } from "../../middlewares/validateObjectId.middleware.js";

const router = Router();
router.use(protect);
router.post("/", adminOrSales, controller.createOrder);
router.get("/", controller.listOrders);
router.get("/:id", validateObjectId, controller.getOrder);
router.patch("/:id", validateObjectId, adminOrSales, controller.updateDraft);
router.patch(
  "/:id/confirm",
  validateObjectId,
  adminOrSales,
  controller.confirmOrder,
);
router.patch(
  "/:id/status",
  validateObjectId,
  adminOrWarehouse,
  controller.setStatus,
);
router.patch(
  "/:id/cancel",
  validateObjectId,
  adminOrSales,
  controller.cancelDraftOrder,
);
router.patch(
  "/:id/request-cancellation",
  validateObjectId,
  adminOrSales,
  controller.requestCancellation,
);
router.patch(
  "/:id/cancellation/approve",
  validateObjectId,
  adminOnly,
  controller.approveCancellation,
);
router.patch(
  "/:id/cancellation/reject",
  validateObjectId,
  adminOnly,
  controller.rejectCancellation,
);
export default router;
