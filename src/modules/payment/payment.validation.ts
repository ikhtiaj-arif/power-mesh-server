import z from "zod";

const InitiatePaymentZodSchema = z.object({
  reservationId: z.string().uuid("Invalid reservation ID"),
  provider: z.enum(["BKASH", "STRIPE"]).default("BKASH"),
});

const BkashCallbackQueryZodSchema = z.object({
  paymentID: z.string().optional(),
  status: z.enum(["success", "cancel", "failure"]).optional(),
  merchantInvoiceNumber: z.string().optional(),
});

const PaymentIdParamZodSchema = z.object({
  id: z.string().uuid("Invalid payment ID"),
});

const ConfirmStripeZodSchema = z.object({
  sessionId: z.string().min(1, "Stripe session id is required"),
});

export const PaymentValidation = {
  InitiatePaymentZodSchema,
  BkashCallbackQueryZodSchema,
  PaymentIdParamZodSchema,
  ConfirmStripeZodSchema,
};
