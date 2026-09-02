import { Router } from "express";
import { AuthController } from "./auth.controller";
import { UserValidation } from "./auth.validation";
import { validateRequest } from "../../middleware/validation";

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

export const AuthRoutes = router;
