import z from "zod";

const CreateOfferZodSchema = z
  .object({
    eventId: z.string().uuid("Invalid event ID"),
    capacityKw: z
      .number()
      .int()
      .positive("Capacity must be a positive integer"),
    pricePerKwh: z.number().positive("Price must be positive"),
    deliveryStart: z.string().datetime("Invalid delivery start date"),
    deliveryEnd: z.string().datetime("Invalid delivery end date"),
  })
  .refine((data) => new Date(data.deliveryEnd) > new Date(data.deliveryStart), {
    message: "deliveryEnd must be after deliveryStart",
  });

const UpdateOfferZodSchema = z.object({
  capacityKw: z.number().int().positive().optional(),
  pricePerKwh: z.number().positive().optional(),
  deliveryStart: z.string().datetime().optional(),
  deliveryEnd: z.string().datetime().optional(),
  status: z
    .enum([
      "AVAILABLE",
      "PARTIALLY_AVAILABLE",
      "FULLY_ALLOCATED",
      "EXPIRED",
      "CANCELLED",
    ])
    .optional(),
});

const OfferIdParamZodSchema = z.object({
  id: z.string().uuid("Invalid offer ID"),
});

const EventIdParamZodSchema = z.object({
  eventId: z.string().uuid("Invalid event ID"),
});

export const OfferValidation = {
  CreateOfferZodSchema,
  UpdateOfferZodSchema,
  OfferIdParamZodSchema,
  EventIdParamZodSchema,
};
