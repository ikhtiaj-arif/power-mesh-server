import type {
  PaymentStatus,
  ReservationStatus,
} from "../../../prisma/generated/prisma/enums";

export interface ICreateReservationPayload {
  offerId: string;
  requestId: string;
}

export interface IGetAllReservationsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  searchTerm?: string;
  status?: ReservationStatus;
  paymentStatus?: PaymentStatus;
  eventId?: string;
}

export interface IGetMyReservationsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: ReservationStatus;
}

export interface IGetProviderReservationsParams {
  providerId: string;
}

export interface IGetProviderReservationsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: ReservationStatus;
}

export interface IGetReservationByIdParams {
  id: string;
}

export interface ICancelReservationParams {
  id: string;
}
