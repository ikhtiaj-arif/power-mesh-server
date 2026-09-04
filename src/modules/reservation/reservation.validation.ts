import z from "zod";

const CreateReservationZodSchema = z.object({
  offerId: z.string().uuid("Invalid offer ID"),
  requestId: z.string().uuid("Invalid request ID"),
});

const ReservationIdParamZodSchema = z.object({
  id: z.string().uuid("Invalid reservation ID"),
});

const ProviderIdParamZodSchema = z.object({
  providerId: z.string().uuid("Invalid provider ID"),
});

export const ReservationValidation = {
  CreateReservationZodSchema,
  ReservationIdParamZodSchema,
  ProviderIdParamZodSchema,
};
