import { Router } from "express";
import { UserRole } from "../../../prisma/generated/prisma/enums";
import { auth } from "../../app/middleware/checkAuth";
import { validateRequest } from "../../app/middleware/validation";
import { CapacityRequestController } from "./capacity-request.controller";
import { CapacityRequestValidation } from "./capacity-request.validation";

const router = Router();

router.post(
  "/create",
  auth(UserRole.CONSUMER),
  validateRequest(CapacityRequestValidation.CreateRequestZodSchema),
  CapacityRequestController.createRequest,
);

router.get(
  "/all",
  auth(UserRole.ADMIN, UserRole.OPERATOR),
  CapacityRequestController.getAllRequests,
);

router.get("/my-requests", auth(UserRole.CONSUMER), CapacityRequestController.getMyRequests);

router.get(
  "/event/:eventId",
  auth(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CONSUMER),
  CapacityRequestController.getRequestsByEvent,
);

router.get(
  "/:id",
  auth(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CONSUMER),
  CapacityRequestController.getRequestById,
);

router.patch(
  "/update/:id",
  auth(UserRole.CONSUMER),
  validateRequest(CapacityRequestValidation.UpdateRequestZodSchema),
  CapacityRequestController.updateRequest,
);

router.patch("/cancel/:id", auth(UserRole.CONSUMER), CapacityRequestController.cancelRequest);

router.patch(
  "/soft-delete/:id",
  auth(UserRole.CONSUMER),
  CapacityRequestController.softDeleteRequest,
);

export const CapacityRequestRoutes = router;
