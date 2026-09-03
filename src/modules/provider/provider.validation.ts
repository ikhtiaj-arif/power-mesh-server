import z from "zod";

const ResourceTypeEnum = z.enum([
  "GENERATOR",
  "SOLAR_BESS",
  "BATTERY",
  "MICROGRID",
  "OTHER",
]);

const ApplyAsProviderZodSchema = z.object({
  firstName: z
    .string()
    .min(3, "First name must be at least 3 characters long")
    .max(50),
  lastName: z
    .string()
    .min(3, "Last name must be at least 3 characters long")
    .max(50),
  email: z.email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
    .regex(/[0-9]/, "Password must contain at least 1 number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least 1 special character",
    ),
  provider: z.object({
    companyName: z.string().min(2, "Company name is required"),
    licenseNumber: z.string().min(2, "License number is required"),
    resourceType: ResourceTypeEnum,
    capacityKw: z
      .number()
      .int()
      .positive("Capacity must be a positive integer"),
    address: z.string().min(2, "Address is required"),
    contactPerson: z.string().min(2, "Contact person is required"),
    contactPhone: z.string().min(2, "Contact phone is required"),
    bankAccountNumber: z.string().optional(),
  }),
});

const VerifyProviderEmailZodSchema = z.object({
  email: z.email("Invalid email address"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

const ApproveProviderZodSchema = z.object({
  providerId: z.string().uuid("Invalid provider ID"),
});

const RejectProviderZodSchema = z.object({
  providerId: z.string().uuid("Invalid provider ID"),
  rejectionReason: z
    .string()
    .min(3, "Rejection reason is required")
    .max(500),
});

const GetAllProvidersZodSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  status: z
    .enum([
      "PENDING_EMAIL_VERIFICATION",
      "PENDING_APPROVAL",
      "APPROVED",
      "REJECTED",
    ])
    .optional(),
});

const GetProviderByIdZodSchema = z.object({
  id: z.string().uuid("Invalid provider ID"),
});

export const ProviderValidation = {
  ApplyAsProviderZodSchema,
  VerifyProviderEmailZodSchema,
  ApproveProviderZodSchema,
  RejectProviderZodSchema,
  GetAllProvidersZodSchema,
  GetProviderByIdZodSchema,
};
