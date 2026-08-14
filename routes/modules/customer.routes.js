import { Router } from "express";
import * as controller from "../../controllers/customer.controller.js";
import { adminOrSales } from "../../middlewares/adminOrSales.middleware.js";
import { protect } from "../../middlewares/protect.middleware.js";
import { validateObjectId } from "../../middlewares/validateObjectId.middleware.js";

const router = Router();
router.use(protect, adminOrSales);
router.get("/", controller.listCustomers);
router.get("/:id", validateObjectId, controller.getCustomer);
router.post("/", controller.createCustomer);
router.patch("/:id", validateObjectId, controller.updateCustomer);
router.delete("/:id", validateObjectId, controller.deleteCustomer);
export default router;
