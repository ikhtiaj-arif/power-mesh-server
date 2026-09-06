import z from "zod";

const CreateEventZodSchema = z
  .object({
    scheduledStart: z.string().datetime("Invalid scheduled start date"),
    scheduledEnd: z.string().datetime("Invalid scheduled end date"),
    totalCapacityKw: z
      .number()
      .int()
      .positive("Total capacity must be a positive integer"),
    survivalQuotaKw: z
      .number()
      .int()
      .positive("Survival quota must be a positive integer"),
    notes: z.string().max(1000).optional(),
  })
  .refine((data) => new Date(data.scheduledEnd) > new Date(data.scheduledStart), {
    message: "scheduledEnd must be after scheduledStart",
  })
  .refine((data) => data.survivalQuotaKw <= data.totalCapacityKw, {
    message: "survivalQuotaKw cannot exceed totalCapacityKw",
  });

const UpdateEventZodSchema = z
  .object({
    scheduledStart: z.string().datetime().optional(),
    scheduledEnd: z.string().datetime().optional(),
    totalCapacityKw: z.number().int().positive().optional(),
    survivalQuotaKw: z.number().int().positive().optional(),
    notes: z.string().max(1000).optional(),
    actualStart: z.string().datetime().optional(),
    actualEnd: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.totalCapacityKw !== undefined && data.survivalQuotaKw !== undefined) {
        return data.survivalQuotaKw <= data.totalCapacityKw;
      }
      return true;
    },
    { message: "survivalQuotaKw cannot exceed totalCapacityKw" },
  )
  .refine(
    (data) => {
      if (data.scheduledStart !== undefined && data.scheduledEnd !== undefined) {
        return new Date(data.scheduledEnd) > new Date(data.scheduledStart);
      }
      return true;
    },
    { message: "scheduledEnd must be after scheduledStart" },
  );

const UpdateEventStatusZodSchema = z.object({
  status: z.enum([
    "SCHEDULED",
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ]),
});

const EventIdParamZodSchema = z.object({
  id: z.string().uuid("Invalid event ID"),
});

export const EventValidation = {
  CreateEventZodSchema,
  UpdateEventZodSchema,
  UpdateEventStatusZodSchema,
  EventIdParamZodSchema,
};
