import { Router } from "express";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";
import { validateRequest } from "../../app/middleware/validation";
import { auth } from "../../app/middleware/checkAuth";
import { UserRole } from "../../../prisma/generated/prisma/enums";

const router = Router();

router.post(
  "/initiate",
  auth(UserRole.CONSUMER),
  validateRequest(PaymentValidation.InitiatePaymentZodSchema),
  PaymentController.initiatePayment,
);

router.get("/callback", PaymentController.handleBkashCallback);

router.get(
  "/my-payments",
  auth(UserRole.CONSUMER),
  PaymentController.getMyPayments,
);

router.get(
  "/all",
  auth(UserRole.ADMIN, UserRole.OPERATOR),
  PaymentController.getAllPayments,
);

router.get(
  "/:id",
  auth(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CONSUMER, UserRole.PROVIDER),
  PaymentController.getPaymentById,
);

export const PaymentRoutes = router;
