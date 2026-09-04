import { Router } from "express";
import { OfferController } from "./offer.controller";
import { OfferValidation } from "./offer.validation";
import { validateRequest } from "../../app/middleware/validation";
import { auth } from "../../app/middleware/checkAuth";
import { UserRole } from "../../../prisma/generated/prisma/enums";

const router = Router();

router.post(
  "/create",
  auth(UserRole.PROVIDER),
  validateRequest(OfferValidation.CreateOfferZodSchema),
  OfferController.createOffer,
);

router.get(
  "/all",
  auth(UserRole.ADMIN, UserRole.OPERATOR),
  OfferController.getAllOffers,
);

router.get(
  "/my-offers",
  auth(UserRole.PROVIDER),
  OfferController.getMyOffers,
);

router.get(
  "/event/:eventId",
  auth(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CONSUMER),
  OfferController.getOffersByEvent,
);

router.get(
  "/:id",
  auth(UserRole.ADMIN, UserRole.OPERATOR, UserRole.PROVIDER),
  OfferController.getOfferById,
);

router.patch(
  "/update/:id",
  auth(UserRole.PROVIDER),
  validateRequest(OfferValidation.UpdateOfferZodSchema),
  OfferController.updateOffer,
);

router.patch(
  "/soft-delete/:id",
  auth(UserRole.PROVIDER),
  OfferController.softDeleteOffer,
);

export const OfferRoutes = router;
