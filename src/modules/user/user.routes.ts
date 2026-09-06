import { Router } from "express";
import { UserRole } from "../../../prisma/generated/prisma/enums";
import { upload } from "../../app/lib/multer";
import { auth } from "../../app/middleware/checkAuth";
import { validateRequest } from "../../app/middleware/validation";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";

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

router.patch(
  "/me/profile-picture",
  auth(UserRole.ADMIN, UserRole.CONSUMER, UserRole.PROVIDER, UserRole.OPERATOR),
  upload.single("profilePicture"),
  UserController.uploadProfilePicture,
);

export const UserRoutes = router;
