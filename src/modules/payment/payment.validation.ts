import z from "zod";

const InitiatePaymentZodSchema = z.object({
  reservationId: z.string().uuid("Invalid reservation ID"),
});

const BkashCallbackQueryZodSchema = z.object({
  paymentID: z.string().optional(),
  status: z.enum(["success", "cancel", "failure"]).optional(),
  merchantInvoiceNumber: z.string().optional(),
});

const PaymentIdParamZodSchema = z.object({
  id: z.string().uuid("Invalid payment ID"),
});

export const PaymentValidation = {
  InitiatePaymentZodSchema,
  BkashCallbackQueryZodSchema,
  PaymentIdParamZodSchema,
};
