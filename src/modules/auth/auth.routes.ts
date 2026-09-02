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

export const AuthRoutes = router;
