import { Router } from "express";
import { UserRole } from "../../../prisma/generated/prisma/enums";
import { auth } from "../../app/middleware/checkAuth";
import { validateRequest } from "../../app/middleware/validation";
import { DeliveryController } from "./delivery.controller";
import { DeliveryValidation } from "./delivery.validation";

const router = Router();

router.get(
  "/:reservationId",
  auth(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CONSUMER, UserRole.PROVIDER),
  DeliveryController.getDeliveryByReservation,
);

router.post(
  "/:reservationId/provider-check-in",
  auth(UserRole.PROVIDER),
  DeliveryController.providerCheckIn,
);

router.post(
  "/:reservationId/provider-report",
  auth(UserRole.PROVIDER),
  validateRequest(DeliveryValidation.ProviderReportZodSchema),
  DeliveryController.providerReport,
);

router.post(
  "/:reservationId/consumer-confirm",
  auth(UserRole.CONSUMER),
  DeliveryController.consumerConfirm,
);

router.post(
  "/:reservationId/consumer-dispute",
  auth(UserRole.CONSUMER),
  validateRequest(DeliveryValidation.ConsumerDisputeZodSchema),
  DeliveryController.consumerDispute,
);

export const DeliveryRoutes = router;
