import { Router } from "express";
import { AdminController } from "./admin.controller";
import { AdminValidation } from "./admin.validation";
import { validateRequest } from "../../app/middleware/validation";
import { auth } from "../../app/middleware/checkAuth";
import { UserRole } from "../../../prisma/generated/prisma/enums";

const router = Router();

router.get(
  "/overview",
  auth(UserRole.ADMIN),
  AdminController.getOverview,
);

router.get(
  "/users",
  auth(UserRole.ADMIN),
  AdminController.getAllUsers,
);

router.get(
  "/users/:id",
  auth(UserRole.ADMIN),
  AdminController.getUserById,
);

router.patch(
  "/users/:id/block",
  auth(UserRole.ADMIN),
  validateRequest(AdminValidation.BlockUserZodSchema),
  AdminController.blockUser,
);

router.patch(
  "/users/:id/soft-delete",
  auth(UserRole.ADMIN),
  AdminController.softDeleteUser,
);

router.get(
  "/audit-logs",
  auth(UserRole.ADMIN),
  AdminController.getAuditLogs,
);

export const AdminRoutes = router;
