import { Router } from "express";
import { ProviderController } from "./provider.controller";
import { ProviderValidation } from "./provider.validation";
import { validateRequest } from "../../app/middleware/validation";
import { auth } from "../../app/middleware/checkAuth";
import { UserRole } from "../../../prisma/generated/prisma/enums";

const router = Router();

router.post(
  "/apply-as-provider",
  validateRequest(ProviderValidation.ApplyAsProviderZodSchema),
  ProviderController.applyAsProvider,
);

router.post(
  "/verify-email",
  validateRequest(ProviderValidation.VerifyProviderEmailZodSchema),
  ProviderController.verifyProviderEmail,
);

router.patch(
  "/approve-provider",
  auth(UserRole.ADMIN, UserRole.OPERATOR),
  validateRequest(ProviderValidation.ApproveProviderZodSchema),
  ProviderController.approveProvider,
);

router.patch(
  "/reject-provider",
  auth(UserRole.ADMIN, UserRole.OPERATOR),
  validateRequest(ProviderValidation.RejectProviderZodSchema),
  ProviderController.rejectProvider,
);

router.get(
  "/all-providers",
  auth(UserRole.ADMIN, UserRole.OPERATOR),
  ProviderController.getAllProviders,
);

router.get(
  "/:id",
  auth(UserRole.ADMIN, UserRole.OPERATOR),
  ProviderController.getProviderById,
);

export const ProviderRoutes = router;
