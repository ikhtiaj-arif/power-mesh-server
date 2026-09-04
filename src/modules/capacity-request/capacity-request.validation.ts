import z from "zod";

const CreateRequestZodSchema = z.object({
  eventId: z.string().uuid("Invalid event ID"),
  requestedKw: z
    .number()
    .int()
    .positive("Requested capacity must be a positive integer"),
  maxPricePerKwh: z.number().positive("Max price must be positive"),
  priorityTier: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "FLEXIBLE"]),
});

const UpdateRequestZodSchema = z.object({
  requestedKw: z.number().int().positive().optional(),
  maxPricePerKwh: z.number().positive().optional(),
  priorityTier: z
    .enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "FLEXIBLE"])
    .optional(),
});

const RequestIdParamZodSchema = z.object({
  id: z.string().uuid("Invalid request ID"),
});

const EventIdParamZodSchema = z.object({
  eventId: z.string().uuid("Invalid event ID"),
});

export const CapacityRequestValidation = {
  CreateRequestZodSchema,
  UpdateRequestZodSchema,
  RequestIdParamZodSchema,
  EventIdParamZodSchema,
};
