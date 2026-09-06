import { Router } from "express";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";
import { validateRequest } from "../../app/middleware/validation";
import { auth } from "../../app/middleware/checkAuth";
import { UserRole } from "../../../prisma/generated/prisma/enums";

const router = Router();

router.get(
  "/me",
  auth(UserRole.ADMIN, UserRole.CONSUMER, UserRole.PROVIDER, UserRole.OPERATOR),
  UserController.getMe,
);

router.patch(
  "/me",
  auth(UserRole.ADMIN, UserRole.CONSUMER, UserRole.PROVIDER, UserRole.OPERATOR),
  validateRequest(UserValidation.UpdateMeZodSchema),
  UserController.updateMe,
);

export const UserRoutes = router;