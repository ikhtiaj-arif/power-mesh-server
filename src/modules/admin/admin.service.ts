import httpStatus from "http-status";
import { prisma } from "../../app/lib/primsa";
import { AppError } from "../../utils/appError";
import { UserStatus } from "../../../prisma/generated/prisma/enums";
import type {
  Prisma,
  UserWhereInput,
} from "../../../prisma/generated/prisma";
import type {
  IBlockUserParams,
  IBlockUserPayload,
  IGetAllUsersQuery,
  IGetAuditLogsQuery,
  IGetUserByIdParams,
  ISoftDeleteUserParams,
} from "./admin.interface";

const getOverview = async () => {
  const [
    totalUsers,
    activeUsers,
    blockedUsers,
    totalProviders,
    approvedProviders,
    totalEvents,
    activeEvents,
    totalReservations,
    totalOffers,
  ] = await Promise.all([
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.user.count({
      where: { isDeleted: false, isActive: true, status: UserStatus.ACTIVE },
    }),
    prisma.user.count({ where: { status: UserStatus.BLOCKED } }),
    prisma.provider.count({ where: { deletedAt: null } }),
    prisma.provider.count({ where: { deletedAt: null, verified: true } }),
    prisma.outageEvent.count({ where: { deletedAt: null } }),
    prisma.outageEvent.count({
      where: {
        deletedAt: null,
        status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
      },
    }),
    prisma.reservation.count({ where: { deletedAt: null } }),
    prisma.capacityOffer.count({ where: { deletedAt: null } }),
  ]);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      blocked: blockedUsers,
    },
    providers: {
      total: totalProviders,
      approved: approvedProviders,
    },
    events: {
      total: totalEvents,
      active: activeEvents,
    },
    reservations: {
      total: totalReservations,
    },
    offers: {
      total: totalOffers,
    },
  };
};

const getAllUsers = async (query: IGetAllUsersQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: UserWhereInput[] = [];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        {
          firstName: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          lastName: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (query.role) {
    andConditions.push({ role: query.role });
  }

  if (query.status) {
    andConditions.push({ status: query.status });
  }

  andConditions.push({ isDeleted: false });

  const where: Prisma.UserWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [users, totalUserCount] = await Promise.all([
    prisma.user.findMany({
      where,
      take: limit,
      skip,
      orderBy: {
        [sortBy]: sortOrder,
      },
      omit: { password: true },
      include: {
        provider: true,
        consumer: true,
        operator: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users,
    meta: {
      page,
      limit,
      total: totalUserCount,
      totalPages: Math.ceil(totalUserCount / limit),
    },
  };
};

const getUserById = async (params: IGetUserByIdParams) => {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    omit: { password: true },
    include: {
      provider: true,
      consumer: true,
      operator: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

const blockUser = async (
  params: IBlockUserParams,
  payload: IBlockUserPayload,
) => {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.role === "ADMIN") {
    throw new AppError(httpStatus.FORBIDDEN, "Cannot block an admin user");
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      status: payload.isBlocked ? UserStatus.BLOCKED : UserStatus.ACTIVE,
      isActive: !payload.isBlocked,
    },
    omit: { password: true },
  });

  return updated;
};

const softDeleteUser = async (params: ISoftDeleteUserParams) => {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.role === "ADMIN") {
    throw new AppError(httpStatus.FORBIDDEN, "Cannot delete an admin user");
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      status: UserStatus.DELETED,
      isActive: false,
    },
    omit: { password: true },
  });

  return updated;
};

const getAuditLogs = async (query: IGetAuditLogsQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: Prisma.AuditLogWhereInput[] = [];

  if (query.action) {
    andConditions.push({ action: query.action });
  }

  if (query.entityType) {
    andConditions.push({ entityType: query.entityType });
  }

  if (query.entityId) {
    andConditions.push({ entityId: query.entityId });
  }

  if (query.userId) {
    andConditions.push({ userId: query.userId });
  }

  const where: Prisma.AuditLogWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [logs, totalLogCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      take: limit,
      skip,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        user: {
          omit: { password: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: logs,
    meta: {
      page,
      limit,
      total: totalLogCount,
      totalPages: Math.ceil(totalLogCount / limit),
    },
  };
};

export const AdminServices = {
  getOverview,
  getAllUsers,
  getUserById,
  blockUser,
  softDeleteUser,
  getAuditLogs,
};
