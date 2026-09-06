import httpStatus from "http-status";
import crypto from "crypto";
import { prisma } from "../../app/lib/primsa";
import { AppError } from "../../utils/appError";
import {
  AuditAction,
  DeliveryStatus,
  IncidentStatus,
  IncidentType,
  OfferStatus,
  PaymentStatus,
  PriorityTier,
  RequestStatus,
  ReservationStatus,
  UserStatus,
} from "../../../prisma/generated/prisma/enums";
import { Prisma } from "../../../prisma/generated/prisma/client";
import type { UserWhereInput } from "../../../prisma/generated/prisma/models";
import type {
  IBlockUserParams,
  IBlockUserPayload,
  IGetAllUsersQuery,
  IGetAuditLogsQuery,
  IGetEventParams,
  IGetReservationParams,
  IGetUserByIdParams,
  ISoftDeleteUserParams,
  IUpdateReservationStatusPayload,
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

  const where: Prisma.UserWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

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

  const where: Prisma.AuditLogWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

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

const getDashboardStats = async () => {
  const [
    totalUsers,
    activeUsers,
    blockedUsers,
    totalProviders,
    approvedProviders,
    pendingProviders,
    totalConsumers,
    totalEvents,
    activeEvents,
    totalOffers,
    totalRequests,
    pendingRequests,
    totalReservations,
    completedReservations,
    failedReservations,
    totalPayments,
    completedPayments,
    openIncidents,
    revenueAggregate,
    refundAggregate,
  ] = await Promise.all([
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.user.count({
      where: { isDeleted: false, isActive: true, status: UserStatus.ACTIVE },
    }),
    prisma.user.count({ where: { status: UserStatus.BLOCKED } }),
    prisma.provider.count({ where: { deletedAt: null } }),
    prisma.provider.count({ where: { deletedAt: null, verified: true } }),
    prisma.provider.count({ where: { deletedAt: null, verified: false } }),
    prisma.consumer.count({ where: { deletedAt: null } }),
    prisma.outageEvent.count({ where: { deletedAt: null } }),
    prisma.outageEvent.count({
      where: {
        deletedAt: null,
        status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
      },
    }),
    prisma.capacityOffer.count({ where: { deletedAt: null } }),
    prisma.capacityRequest.count({ where: { deletedAt: null } }),
    prisma.capacityRequest.count({
      where: { deletedAt: null, status: RequestStatus.PENDING },
    }),
    prisma.reservation.count({ where: { deletedAt: null } }),
    prisma.reservation.count({
      where: { deletedAt: null, status: ReservationStatus.DELIVERY_CONFIRMED },
    }),
    prisma.reservation.count({
      where: {
        deletedAt: null,
        status: {
          in: [
            ReservationStatus.FAILED,
            ReservationStatus.REFUNDED,
            ReservationStatus.CANCELLED,
          ],
        },
      },
    }),
    prisma.payment.count({ where: { deletedAt: null } }),
    prisma.payment.count({
      where: { deletedAt: null, gatewayStatus: PaymentStatus.COMPLETED },
    }),
    prisma.incident.count({ where: { deletedAt: null, status: IncidentStatus.OPEN } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { deletedAt: null, gatewayStatus: PaymentStatus.COMPLETED },
    }),
    prisma.refund.aggregate({
      _sum: { amount: true },
      where: { deletedAt: null },
    }),
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
      pending: pendingProviders,
    },
    consumers: {
      total: totalConsumers,
    },
    events: {
      total: totalEvents,
      active: activeEvents,
    },
    capacity: {
      offers: totalOffers,
      requests: totalRequests,
      pendingRequests,
    },
    reservations: {
      total: totalReservations,
      completed: completedReservations,
      failed: failedReservations,
    },
    payments: {
      total: totalPayments,
      completed: completedPayments,
      revenue: revenueAggregate._sum.amount ?? 0,
    },
    incidents: {
      open: openIncidents,
    },
    refunds: {
      totalAmount: refundAggregate._sum.amount ?? 0,
    },
  };
};

const PRIORITY_ORDER = [
  PriorityTier.CRITICAL,
  PriorityTier.HIGH,
  PriorityTier.MEDIUM,
  PriorityTier.LOW,
  PriorityTier.FLEXIBLE,
];

interface IAllocationPlanEntry {
  offerId: string;
  requestId: string;
  consumerId: string;
  providerId: string;
  allocatedKw: number;
  unitPrice: number;
  totalAmount: number;
  deliveryStart: Date;
  deliveryEnd: Date;
}

interface IAllocationPlan {
  eventId: string;
  eventStatus: string;
  totalRequests: number;
  allocatedRequests: number;
  skipped: { requestId: string; reason: string }[];
  totalAllocatedKw: number;
  allocations: IAllocationPlanEntry[];
}

const computeAllocationPlan = (
  event: {
    id: string;
    status: string;
  },
  offers: Prisma.CapacityOfferGetPayload<{}>[],
  requests: Prisma.CapacityRequestGetPayload<{}>[],
): IAllocationPlan => {
  const availableOffers = offers
    .filter(
      (offer) =>
        offer.status === OfferStatus.AVAILABLE ||
        offer.status === OfferStatus.PARTIALLY_AVAILABLE,
    )
    .map((offer) => ({
      ...offer,
      remaining: offer.capacityKw - offer.reservedKw,
    }))
    .filter((offer) => offer.remaining > 0)
    .sort(
      (a, b) =>
        Number(a.pricePerKwh) - Number(b.pricePerKwh) ||
        a.deliveryStart.getTime() - b.deliveryStart.getTime(),
    );

  const pendingRequests = requests
    .filter((request) => request.status === RequestStatus.PENDING)
    .sort(
      (a, b) =>
        PRIORITY_ORDER.indexOf(a.priorityTier) -
          PRIORITY_ORDER.indexOf(b.priorityTier) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );

  const allocations: IAllocationPlanEntry[] = [];
  const skipped: { requestId: string; reason: string }[] = [];

  for (const request of pendingRequests) {
    const offer = availableOffers.find(
      (candidate) =>
        candidate.remaining >= request.requestedKw &&
        Number(candidate.pricePerKwh) <= Number(request.maxPricePerKwh),
    );

    if (!offer) {
      skipped.push({
        requestId: request.id,
        reason: "No offer with sufficient remaining capacity within the requested budget",
      });
      continue;
    }

    allocations.push({
      offerId: offer.id,
      requestId: request.id,
      consumerId: request.consumerId,
      providerId: offer.providerId,
      allocatedKw: request.requestedKw,
      unitPrice: Number(offer.pricePerKwh),
      totalAmount: request.requestedKw * Number(offer.pricePerKwh),
      deliveryStart: offer.deliveryStart,
      deliveryEnd: offer.deliveryEnd,
    });

    offer.remaining -= request.requestedKw;
  }

  const totalAllocatedKw = allocations.reduce(
    (sum, allocation) => sum + allocation.allocatedKw,
    0,
  );

  return {
    eventId: event.id,
    eventStatus: event.status,
    totalRequests: pendingRequests.length,
    allocatedRequests: allocations.length,
    skipped,
    totalAllocatedKw,
    allocations,
  };
};

const getEventWithCapacity = async (eventId: string) => {
  const event = await prisma.outageEvent.findUnique({
    where: { id: eventId, deletedAt: null },
    include: {
      capacityOffers: true,
      capacityRequests: true,
    },
  });

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage event not found");
  }

  return event;
};

const runAllocation = async (params: IGetEventParams) => {
  const event = await getEventWithCapacity(params.id);

  if (
    event.status !== "SCHEDULED" &&
    event.status !== "CONFIRMED"
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Allocation cannot be computed for event with status "${event.status}"`,
    );
  }

  const plan = computeAllocationPlan(event, event.capacityOffers, event.capacityRequests);

  return {
    eventId: event.id,
    eventStatus: event.status,
    totalRequests: plan.totalRequests,
    allocatedRequests: plan.allocatedRequests,
    skipped: plan.skipped,
    totalAllocatedKw: plan.totalAllocatedKw,
    allocations: plan.allocations,
  };
};

const approveAllocation = async (
  params: IGetEventParams,
  userId: string,
) => {
  const preview = await getEventWithCapacity(params.id);

  if (
    preview.status !== "SCHEDULED" &&
    preview.status !== "CONFIRMED"
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Allocation cannot be approved for event with status "${preview.status}"`,
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.outageEvent.findUnique({
        where: { id: params.id, deletedAt: null },
        include: {
          capacityOffers: true,
          capacityRequests: true,
        },
      });

      if (!event) {
        throw new AppError(httpStatus.NOT_FOUND, "Outage event not found");
      }

      const plan = computeAllocationPlan(
        event,
        event.capacityOffers,
        event.capacityRequests,
      );

      const offerAssignments = new Map<
        string,
        { assignedKw: number; capacityKw: number; reservedKw: number }
      >();

      for (const allocation of plan.allocations) {
        await tx.reservation.create({
          data: {
            offerId: allocation.offerId,
            requestId: allocation.requestId,
            consumerId: allocation.consumerId,
            providerId: allocation.providerId,
            allocatedKw: allocation.allocatedKw,
            unitPrice: allocation.unitPrice,
            totalAmount: allocation.totalAmount,
            deliveryStart: allocation.deliveryStart,
            deliveryEnd: allocation.deliveryEnd,
            idempotencyKey: crypto.randomUUID(),
            status: ReservationStatus.ALLOCATED,
          },
        });

        await tx.capacityRequest.update({
          where: { id: allocation.requestId },
          data: { status: RequestStatus.ALLOCATED },
        });

        const current = offerAssignments.get(allocation.offerId) ?? {
          assignedKw: 0,
          capacityKw: 0,
          reservedKw: 0,
        };
        current.assignedKw += allocation.allocatedKw;
        current.capacityKw = event.capacityOffers.find(
          (offer) => offer.id === allocation.offerId,
        )?.capacityKw ?? 0;
        current.reservedKw = event.capacityOffers.find(
          (offer) => offer.id === allocation.offerId,
        )?.reservedKw ?? 0;
        offerAssignments.set(allocation.offerId, current);
      }

      for (const [offerId, assignment] of offerAssignments) {
        const newReservedKw = assignment.reservedKw + assignment.assignedKw;
        await tx.capacityOffer.update({
          where: { id: offerId },
          data: {
            reservedKw: newReservedKw,
            status:
              newReservedKw >= assignment.capacityKw
                ? OfferStatus.FULLY_ALLOCATED
                : OfferStatus.PARTIALLY_AVAILABLE,
          },
        });
      }

      if (plan.totalAllocatedKw > 0) {
        await tx.outageEvent.update({
          where: { id: event.id },
          data: { allocatedKw: { increment: plan.totalAllocatedKw } },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          entityType: "outage_event",
          entityId: event.id,
          action: AuditAction.ALLOCATE,
          newValues: {
            allocatedRequests: plan.allocations.length,
            skippedRequests: plan.skipped.length,
            totalAllocatedKw: plan.totalAllocatedKw,
          },
        },
      });

      return {
        eventId: event.id,
        eventStatus: event.status,
        totalRequests: plan.totalRequests,
        allocatedRequests: plan.allocations.length,
        skipped: plan.skipped,
        totalAllocatedKw: plan.totalAllocatedKw,
      };
    });

    return result;
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      throw new AppError(
        httpStatus.CONFLICT,
        "Allocation for this event has already been approved. Some requests were already allocated.",
      );
    }
    throw error;
  }
};

const updateReservationStatus = async (
  params: IGetReservationParams,
  payload: IUpdateReservationStatusPayload,
  userId: string,
) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: {
      offer: true,
      payment: true,
      delivery: true,
    },
  });

  if (!reservation || reservation.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Reservation not found");
  }

  const newStatus = payload.status;
  const isFailureStatus =
    newStatus === ReservationStatus.FAILED ||
    newStatus === ReservationStatus.REFUNDED;
  const isCancellation = newStatus === ReservationStatus.CANCELLED;

  const releaseOfferCapacity = (
    tx: Prisma.TransactionClient,
    allocatedKw: number,
  ) => {
    const newReservedKw = Math.max(
      0,
      reservation.offer.reservedKw - allocatedKw,
    );

    return tx.capacityOffer.update({
      where: { id: reservation.offerId },
      data: {
        reservedKw: newReservedKw,
        status:
          newReservedKw > 0
            ? OfferStatus.PARTIALLY_AVAILABLE
            : OfferStatus.AVAILABLE,
      },
    });
  };

  const updated = await prisma.$transaction(async (tx) => {
    if (
      newStatus === ReservationStatus.DELIVERY_CONFIRMED &&
      reservation.delivery !== null &&
      (reservation.delivery.status === DeliveryStatus.DISPUTED ||
        reservation.delivery.status === DeliveryStatus.PENDING_CHECKIN)
    ) {
      await tx.delivery.update({
        where: { id: reservation.delivery.id },
        data: {
          status: DeliveryStatus.RESOLVED,
          confirmedByConsumer: userId,
          consumerConfirmedAt: new Date(),
        },
      });
    }

    if (isFailureStatus) {
      if (reservation.payment !== null) {
        await tx.refund.create({
          data: {
            paymentId: reservation.payment.id,
            reservationId: reservation.id,
            amount: reservation.totalAmount,
            reason:
              newStatus === ReservationStatus.REFUNDED
                ? "Full refund after failed delivery"
                : "Refund after delivery failure",
          },
        });

        await tx.payment.update({
          where: { id: reservation.payment.id },
          data: { gatewayStatus: PaymentStatus.REFUNDED },
        });
      }

      await tx.incident.create({
        data: {
          providerId: reservation.providerId,
          reservationId: reservation.id,
          incidentType:
            newStatus === ReservationStatus.REFUNDED
              ? IncidentType.NO_SHOW
              : IncidentType.TECHNICAL_FAILURE,
          description: `Reservation ${reservation.id} marked ${newStatus} by operator${payload.resolution ? ` - ${payload.resolution}` : ""}`,
          occurredAt: new Date(),
          status: IncidentStatus.OPEN,
        },
      });

      await releaseOfferCapacity(tx, reservation.allocatedKw);
    }

    if (isCancellation) {
      await tx.capacityRequest.update({
        where: { id: reservation.requestId },
        data: { status: RequestStatus.CANCELLED },
      });

      if (reservation.payment === null) {
        await releaseOfferCapacity(tx, reservation.allocatedKw);
      }
    }

    const updatedReservation = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: newStatus,
        ...(payload.paymentStatus !== undefined
          ? { paymentStatus: payload.paymentStatus }
          : {}),
      },
      include: {
        payment: true,
        delivery: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        entityType: "reservation",
        entityId: reservation.id,
        action: AuditAction.RESOLVE,
        oldValues: { status: reservation.status },
        newValues: {
          status: newStatus,
          ...(payload.resolution !== undefined
            ? { resolution: payload.resolution }
            : {}),
        },
      },
    });

    return updatedReservation;
  });

  return updated;
};

export const AdminServices = {
  getOverview,
  getAllUsers,
  getUserById,
  blockUser,
  softDeleteUser,
  getAuditLogs,
  getDashboardStats,
  runAllocation,
  approveAllocation,
  updateReservationStatus,
};
