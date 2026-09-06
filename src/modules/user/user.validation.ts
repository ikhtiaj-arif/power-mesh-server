import z from "zod";

const UpdateMeZodSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  consumer: z
    .object({
      organizationName: z.string().optional(),
      criticalLoadKw: z.number().int().positive().optional(),
      address: z.string().optional(),
      contactPerson: z.string().optional(),
      contactPhone: z.string().optional(),
    })
    .optional(),
  provider: z
    .object({
      companyName: z.string().optional(),
      address: z.string().optional(),
      contactPerson: z.string().optional(),
      contactPhone: z.string().optional(),
      bankAccountNumber: z.string().optional(),
    })
    .optional(),
});

export const UserValidation = {
  UpdateMeZodSchema,
};