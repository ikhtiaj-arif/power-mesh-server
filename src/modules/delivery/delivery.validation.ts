import z from "zod";

const ProviderReportZodSchema = z.object({
  actualDeliveredKw: z.number().int().min(0, "Delivered capacity cannot be negative"),
});

const ConsumerDisputeZodSchema = z.object({
  disputeReason: z.string().min(5, "Dispute reason must be at least 5 characters"),
});

export const DeliveryValidation = {
  ProviderReportZodSchema,
  ConsumerDisputeZodSchema,
};
