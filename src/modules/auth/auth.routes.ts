import { Router } from "express";
import { AuthController } from "./auth.controller";
import { UserValidation } from "./auth.validation";
import { validateRequest } from "../../app/middleware/validation";
import { auth } from "../../app/middleware/checkAuth";
import { UserRole } from "../../../prisma/generated/prisma/enums";

const router = Router();

router.post(
  "/register",
  validateRequest(UserValidation.ConsumerRegistrationZodSchema),
  AuthController.registerConsumer,
);

router.post("/login" , AuthController.loginUser);

router.post(
	"/verify-email",
	validateRequest(UserValidation.ConsumerVerifyEmailZodSchema),
	AuthController.verifyConsumerEmail,
);   
router.post("/google-login", AuthController.googleLogin);
router.get(
	"/me",
	auth(UserRole.ADMIN, UserRole.CONSUMER, UserRole.PROVIDER, UserRole.OPERATOR),
	AuthController.getMe,
);

export const AuthRoutes = router;
