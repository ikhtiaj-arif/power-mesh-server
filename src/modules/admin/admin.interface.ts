import type {
  AuditAction,
  UserRole,
  UserStatus,
} from "../../../prisma/generated/prisma/enums";

export interface IGetAllUsersQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  searchTerm?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface IGetUserByIdParams {
  id: string;
}

export interface IBlockUserParams {
  id: string;
}

export interface IBlockUserPayload {
  isBlocked: boolean;
  reason?: string;
}

export interface ISoftDeleteUserParams {
  id: string;
}

export interface IGetAuditLogsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  userId?: string;
}
