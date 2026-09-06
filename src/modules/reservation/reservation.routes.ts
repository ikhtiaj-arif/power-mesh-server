import { Router } from "express";
import { UserRole } from "../../../prisma/generated/prisma/enums";
import { auth } from "../../app/middleware/checkAuth";
import { validateRequest } from "../../app/middleware/validation";
import { ReservationController } from "./reservation.controller";
import { ReservationValidation } from "./reservation.validation";

const router = Router();

router.post(
  "/create",
  auth(UserRole.CONSUMER),
  validateRequest(ReservationValidation.CreateReservationZodSchema),
  ReservationController.createReservation,
);

router.get(
  "/all",
  auth(UserRole.ADMIN, UserRole.OPERATOR),
  ReservationController.getAllReservations,
);

router.get("/my-reservations", auth(UserRole.CONSUMER), ReservationController.getMyReservations);

router.get(
  "/provider/:providerId",
  auth(UserRole.PROVIDER, UserRole.ADMIN, UserRole.OPERATOR),
  ReservationController.getProviderReservations,
);

router.get(
  "/:id",
  auth(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CONSUMER, UserRole.PROVIDER),
  ReservationController.getReservationById,
);

router.patch("/cancel/:id", auth(UserRole.CONSUMER), ReservationController.cancelReservation);

export const ReservationRoutes = router;
