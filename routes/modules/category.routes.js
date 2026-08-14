import { Router } from "express";
import * as controller from "../../controllers/category.controller.js";
import { adminOnly } from "../../middlewares/admin.middleware.js";
import { protect } from "../../middlewares/protect.middleware.js";
import { validateObjectId } from "../../middlewares/validateObjectId.middleware.js";

const router = Router();
router.use(protect);
router.get("/", controller.listCategories);
router.get("/options", controller.listCategoryOptions);
router.post("/", adminOnly, controller.createCategory);
router.patch("/:id", validateObjectId, adminOnly, controller.updateCategory);
router.delete("/:id", validateObjectId, adminOnly, controller.deleteCategory);
export default router;
