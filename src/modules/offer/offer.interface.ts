import type { OfferStatus } from "../../../prisma/generated/prisma/enums";

export interface ICreateOfferPayload {
  eventId: string;
  capacityKw: number;
  pricePerKwh: number;
  deliveryStart: string;
  deliveryEnd: string;
}

export interface IUpdateOfferPayload {
  capacityKw?: number;
  pricePerKwh?: number;
  deliveryStart?: string;
  deliveryEnd?: string;
  status?: OfferStatus;
}

export interface IGetAllOffersQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  searchTerm?: string;
  status?: OfferStatus;
  eventId?: string;
  providerId?: string;
  minCapacity?: number;
  maxCapacity?: number;
}

export interface IGetMyOffersQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  searchTerm?: string;
  status?: OfferStatus;
  eventId?: string;
}

export interface IGetOfferByIdParams {
  id: string;
}

export interface IUpdateOfferParams {
  id: string;
}

export interface ISoftDeleteOfferParams {
  id: string;
}

export interface IGetOffersByEventParams {
  eventId: string;
}

export interface IGetOffersByEventQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: OfferStatus;
}
