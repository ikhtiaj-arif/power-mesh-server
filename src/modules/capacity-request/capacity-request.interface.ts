import type {
  PriorityTier,
  RequestStatus,
} from "../../../prisma/generated/prisma/enums";

export interface ICreateRequestPayload {
  eventId: string;
  requestedKw: number;
  maxPricePerKwh: number;
  priorityTier: PriorityTier;
}

export interface IUpdateRequestPayload {
  requestedKw?: number;
  maxPricePerKwh?: number;
  priorityTier?: PriorityTier;
}

export interface IGetAllRequestsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  searchTerm?: string;
  status?: RequestStatus;
  priorityTier?: PriorityTier;
  eventId?: string;
  consumerId?: string;
}

export interface IGetMyRequestsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: RequestStatus;
  priorityTier?: PriorityTier;
}

export interface IGetRequestsByEventParams {
  eventId: string;
}

export interface IGetRequestsByEventQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: RequestStatus;
}

export interface IGetRequestByIdParams {
  id: string;
}

export interface IUpdateRequestParams {
  id: string;
}

export interface ICancelRequestParams {
  id: string;
}

export interface ISoftDeleteRequestParams {
  id: string;
}
