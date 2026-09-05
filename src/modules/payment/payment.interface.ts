import type {
  PaymentStatus,
  PaymentMethod,
  WebhookStatus,
} from "../../../prisma/generated/prisma/enums";

export interface IInitiatePaymentPayload {
  reservationId: string;
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
