import type {
  PaymentMethod,
  PaymentStatus,
  WebhookStatus,
} from "../../../prisma/generated/prisma/enums";

export type PaymentProvider = "BKASH" | "STRIPE";

export interface IInitiatePaymentPayload {
  reservationId: string;
  /** Defaults to BKASH when omitted (backward compatible). */
  provider?: PaymentProvider;
}

export interface IBkashCallbackQuery {
  paymentID?: string;
  status?: "success" | "cancel" | "failure";
  merchantInvoiceNumber?: string;
}

export interface IPaymentIdParams {
  id: string;
}

export interface IGetMyPaymentsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  gatewayStatus?: PaymentStatus;
}

export interface IGetAllPaymentsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  gatewayStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  webhookStatus?: WebhookStatus;
  consumerEmail?: string;
  reservationId?: string;
}
