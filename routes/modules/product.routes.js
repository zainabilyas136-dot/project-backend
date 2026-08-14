import { Router } from "express";
import * as controller from "../../controllers/product.controller.js";
import { adminOnly } from "../../middlewares/admin.middleware.js";
import { protect } from "../../middlewares/protect.middleware.js";
import { validateObjectId } from "../../middlewares/validateObjectId.middleware.js";

const router = Router();
router.use(protect);
router.get("/", controller.listProducts);
router.get("/:id", validateObjectId, controller.getProduct);
router.post("/", adminOnly, controller.createProduct);
router.patch("/:id", validateObjectId, adminOnly, controller.updateProduct);
router.delete("/:id", validateObjectId, adminOnly, controller.deleteProduct);
export default router;
