import { Router } from "express";
import { EventController } from "./event.controller";
import { EventValidation } from "./event.validation";
import { validateRequest } from "../../app/middleware/validation";
import { auth } from "../../app/middleware/checkAuth";
import { UserRole } from "../../../prisma/generated/prisma/enums";

const router = Router();

router.post(
  "/create",
  auth(UserRole.OPERATOR),
  validateRequest(EventValidation.CreateEventZodSchema),
  EventController.createEvent,
);

router.get(
  "/all",
  auth(UserRole.ADMIN, UserRole.OPERATOR),
  EventController.getAllEvents,
);

router.get(
  "/my-events",
  auth(UserRole.OPERATOR),
  EventController.getMyEvents,
);

router.get(
  "/available",
  auth(UserRole.CONSUMER, UserRole.PROVIDER),
  EventController.getAvailableEvents,
);

router.get(
  "/:id",
  auth(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CONSUMER, UserRole.PROVIDER),
  EventController.getEventById,
);

router.patch(
  "/update/:id",
  auth(UserRole.OPERATOR),
  validateRequest(EventValidation.UpdateEventZodSchema),
  EventController.updateEvent,
);

router.patch(
  "/status/:id",
  auth(UserRole.OPERATOR),
  validateRequest(EventValidation.UpdateEventStatusZodSchema),
  EventController.updateEventStatus,
);

router.patch(
  "/soft-delete/:id",
  auth(UserRole.OPERATOR),
  EventController.softDeleteEvent,
);

export const EventRoutes = router;
