import { Router } from "express";
import { UserRole } from "../../../prisma/generated/prisma/enums";
import { auth } from "../../app/middleware/checkAuth";
import { validateRequest } from "../../app/middleware/validation";
import { AuthController } from "./auth.controller";
import { UserValidation } from "./auth.validation";

const router = Router();

router.post(
  "/register",
  validateRequest(UserValidation.ConsumerRegistrationZodSchema),
  AuthController.registerConsumer,
);

router.post("/login", validateRequest(UserValidation.LoginZodSchema), AuthController.loginUser);

router.post(
  "/verify-email",
  validateRequest(UserValidation.ConsumerVerifyEmailZodSchema),
  AuthController.verifyConsumerEmail,
);
router.post(
  "/google-login",
  validateRequest(UserValidation.GoogleLoginZodSchema),
  AuthController.googleLogin,
);
router.post(
  "/refresh-token",
  validateRequest(UserValidation.RefreshTokenZodSchema),
  AuthController.refreshToken,
);
router.post("/logout", AuthController.logout);
router.get(
  "/me",
  auth(UserRole.ADMIN, UserRole.CONSUMER, UserRole.PROVIDER, UserRole.OPERATOR),
  AuthController.getMe,
);

export const AuthRoutes = router;
