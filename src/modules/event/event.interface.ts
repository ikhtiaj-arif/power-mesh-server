import type { OutageEventStatus } from "../../../prisma/generated/prisma/enums";

export interface ICreateEventPayload {
  scheduledStart: string;
  scheduledEnd: string;
  totalCapacityKw: number;
  survivalQuotaKw: number;
  notes?: string;
}

export interface IUpdateEventPayload {
  scheduledStart?: string;
  scheduledEnd?: string;
  totalCapacityKw?: number;
  survivalQuotaKw?: number;
  notes?: string;
  actualStart?: string;
  actualEnd?: string;
}

export interface IUpdateEventStatusPayload {
  status: OutageEventStatus;
}

export interface IGetAllEventsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  searchTerm?: string;
  status?: OutageEventStatus;
  startDate?: string;
  endDate?: string;
  minCapacity?: number;
  maxCapacity?: number;
}

export interface IGetMyEventsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: OutageEventStatus;
  startDate?: string;
  endDate?: string;
}

export interface IGetAvailableEventsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  startDate?: string;
  endDate?: string;
}

export interface IGetEventByIdParams {
  id: string;
}

export interface IUpdateEventParams {
  id: string;
}

export interface IUpdateEventStatusParams {
  id: string;
}

export interface ISoftDeleteEventParams {
  id: string;
}
