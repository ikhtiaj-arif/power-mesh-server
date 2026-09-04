import httpStatus from "http-status";
import { prisma } from "../../app/lib/primsa";
import { AppError } from "../../utils/appError";
import {
  OfferStatus,
  OutageEventStatus,
  RequestStatus,
} from "../../../prisma/generated/prisma/enums";
import type {
  OutageEventWhereInput,
  Prisma,
} from "../../../prisma/generated/prisma";
import type {
  ICreateEventPayload,
  IGetAllEventsQuery,
  IGetAvailableEventsQuery,
  IGetEventByIdParams,
  IGetMyEventsQuery,
  ISoftDeleteEventParams,
  IUpdateEventParams,
  IUpdateEventPayload,
  IUpdateEventStatusParams,
  IUpdateEventStatusPayload,
} from "./event.interface";

const VALID_STATUS_TRANSITIONS: Record<string, OutageEventStatus[]> = {
  [OutageEventStatus.SCHEDULED]: [
    OutageEventStatus.CONFIRMED,
    OutageEventStatus.CANCELLED,
  ],
  [OutageEventStatus.CONFIRMED]: [
    OutageEventStatus.IN_PROGRESS,
    OutageEventStatus.CANCELLED,
  ],
  [OutageEventStatus.IN_PROGRESS]: [OutageEventStatus.COMPLETED],
  [OutageEventStatus.COMPLETED]: [],
  [OutageEventStatus.CANCELLED]: [],
};

const createEvent = async (
  payload: ICreateEventPayload,
  userId: string,
) => {
  const operator = await prisma.operator.findUnique({
    where: { userId },
  });

  if (!operator) {
    throw new AppError(httpStatus.NOT_FOUND, "Operator profile not found");
  }

  const event = await prisma.outageEvent.create({
    data: {
      operatorId: operator.id,
      scheduledStart: new Date(payload.scheduledStart),
      scheduledEnd: new Date(payload.scheduledEnd),
      totalCapacityKw: payload.totalCapacityKw,
      survivalQuotaKw: payload.survivalQuotaKw,
      notes: payload.notes,
    },
    include: {
      operator: {
        include: {
          user: {
            omit: { password: true },
          },
        },
      },
    },
  });

  return event;
};

const getAllEvents = async (query: IGetAllEventsQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: OutageEventWhereInput[] = [];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        {
          notes: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          operator: {
            user: {
              email: {
                contains: query.searchTerm,
                mode: "insensitive",
              },
            },
          },
        },
        {
          operator: {
            user: {
              firstName: {
                contains: query.searchTerm,
                mode: "insensitive",
              },
            },
          },
        },
        {
          operator: {
            user: {
              lastName: {
                contains: query.searchTerm,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    });
  }

  if (query.status) {
    andConditions.push({ status: query.status });
  }

  if (query.startDate) {
    andConditions.push({
      scheduledStart: { gte: new Date(query.startDate) },
    });
  }

  if (query.endDate) {
    andConditions.push({
      scheduledEnd: { lte: new Date(query.endDate) },
    });
  }

  if (query.minCapacity !== undefined) {
    andConditions.push({
      totalCapacityKw: { gte: query.minCapacity },
    });
  }

  if (query.maxCapacity !== undefined) {
    andConditions.push({
      totalCapacityKw: { lte: query.maxCapacity },
    });
  }

  andConditions.push({ deletedAt: null });

  const where: Prisma.OutageEventWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [allEvents, totalEventCount] = await Promise.all([
    prisma.outageEvent.findMany({
      where,
      take: limit,
      skip,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        operator: {
          include: {
            user: {
              omit: { password: true },
            },
          },
        },
        _count: {
          select: {
            capacityOffers: true,
            capacityRequests: true,
          },
        },
      },
    }),
    prisma.outageEvent.count({ where }),
  ]);

  return {
    data: allEvents,
    meta: {
      page,
      limit,
      total: totalEventCount,
      totalPages: Math.ceil(totalEventCount / limit),
    },
  };
};

const getMyEvents = async (
  query: IGetMyEventsQuery,
  userId: string,
) => {
  const operator = await prisma.operator.findUnique({
    where: { userId },
  });

  if (!operator) {
    throw new AppError(httpStatus.NOT_FOUND, "Operator profile not found");
  }

  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: OutageEventWhereInput[] = [];

  andConditions.push({ operatorId: operator.id });
  andConditions.push({ deletedAt: null });

  if (query.status) {
    andConditions.push({ status: query.status });
  }

  if (query.startDate) {
    andConditions.push({
      scheduledStart: { gte: new Date(query.startDate) },
    });
  }

  if (query.endDate) {
    andConditions.push({
      scheduledEnd: { lte: new Date(query.endDate) },
    });
  }

  const where: Prisma.OutageEventWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [myEvents, totalEventCount] = await Promise.all([
    prisma.outageEvent.findMany({
      where,
      take: limit,
      skip,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        _count: {
          select: {
            capacityOffers: true,
            capacityRequests: true,
          },
        },
      },
    }),
    prisma.outageEvent.count({ where }),
  ]);

  return {
    data: myEvents,
    meta: {
      page,
      limit,
      total: totalEventCount,
      totalPages: Math.ceil(totalEventCount / limit),
    },
  };
};

const getAvailableEvents = async (query: IGetAvailableEventsQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "scheduledStart";
  const sortOrder = query.sortOrder ? query.sortOrder : "asc";

  const andConditions: OutageEventWhereInput[] = [];

  andConditions.push({
    status: {
      in: [OutageEventStatus.SCHEDULED, OutageEventStatus.CONFIRMED],
    },
  });
  andConditions.push({
    scheduledEnd: { gt: new Date() },
  });
  andConditions.push({ deletedAt: null });

  if (query.startDate) {
    andConditions.push({
      scheduledStart: { gte: new Date(query.startDate) },
    });
  }

  if (query.endDate) {
    andConditions.push({
      scheduledEnd: { lte: new Date(query.endDate) },
    });
  }

  const where: Prisma.OutageEventWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [events, totalEventCount] = await Promise.all([
    prisma.outageEvent.findMany({
      where,
      take: limit,
      skip,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        operator: {
          include: {
            user: {
              omit: { password: true },
            },
          },
        },
        _count: {
          select: {
            capacityOffers: true,
          },
        },
      },
    }),
    prisma.outageEvent.count({ where }),
  ]);

  return {
    data: events,
    meta: {
      page,
      limit,
      total: totalEventCount,
      totalPages: Math.ceil(totalEventCount / limit),
    },
  };
};

const getEventById = async (params: IGetEventByIdParams) => {
  const event = await prisma.outageEvent.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      operator: {
        include: {
          user: {
            omit: { password: true },
          },
        },
      },
      capacityOffers: {
        where: { deletedAt: null },
        include: {
          provider: {
            include: {
              user: {
                omit: { password: true },
              },
            },
          },
        },
      },
      capacityRequests: {
        where: { deletedAt: null },
        include: {
          consumer: {
            include: {
              user: {
                omit: { password: true },
              },
            },
          },
        },
      },
    },
  });

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  return event;
};

const updateEvent = async (
  params: IUpdateEventParams,
  payload: IUpdateEventPayload,
  userId: string,
) => {
  const operator = await prisma.operator.findUnique({
    where: { userId },
  });

  if (!operator) {
    throw new AppError(httpStatus.NOT_FOUND, "Operator profile not found");
  }

  const event = await prisma.outageEvent.findUnique({
    where: { id: params.id },
  });

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  if (event.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  if (event.operatorId !== operator.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only update your own events",
    );
  }

  if (event.status !== OutageEventStatus.SCHEDULED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot update event with status "${event.status}". Only SCHEDULED events can be updated.`,
    );
  }

  const updateData: Prisma.OutageEventUpdateInput = {};

  if (payload.scheduledStart !== undefined) {
    updateData.scheduledStart = new Date(payload.scheduledStart);
  }
  if (payload.scheduledEnd !== undefined) {
    updateData.scheduledEnd = new Date(payload.scheduledEnd);
  }
  if (payload.totalCapacityKw !== undefined) {
    updateData.totalCapacityKw = payload.totalCapacityKw;
  }
  if (payload.survivalQuotaKw !== undefined) {
    updateData.survivalQuotaKw = payload.survivalQuotaKw;
  }
  if (payload.notes !== undefined) {
    updateData.notes = payload.notes;
  }
  if (payload.actualStart !== undefined) {
    updateData.actualStart = new Date(payload.actualStart);
  }
  if (payload.actualEnd !== undefined) {
    updateData.actualEnd = new Date(payload.actualEnd);
  }

  const finalTotal = (updateData.totalCapacityKw as number) ?? event.totalCapacityKw;
  const finalSurvival = (updateData.survivalQuotaKw as number) ?? event.survivalQuotaKw;

  if (finalSurvival > finalTotal) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "survivalQuotaKw cannot exceed totalCapacityKw",
    );
  }

  if (updateData.scheduledStart && updateData.scheduledEnd) {
    if (new Date(updateData.scheduledEnd as string) <= new Date(updateData.scheduledStart as string)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "scheduledEnd must be after scheduledStart",
      );
    }
  }

  const updatedEvent = await prisma.outageEvent.update({
    where: { id: params.id },
    data: updateData,
    include: {
      operator: {
        include: {
          user: {
            omit: { password: true },
          },
        },
      },
    },
  });

  return updatedEvent;
};

const updateEventStatus = async (
  params: IUpdateEventStatusParams,
  payload: IUpdateEventStatusPayload,
  userId: string,
) => {
  const operator = await prisma.operator.findUnique({
    where: { userId },
  });

  if (!operator) {
    throw new AppError(httpStatus.NOT_FOUND, "Operator profile not found");
  }

  const event = await prisma.outageEvent.findUnique({
    where: { id: params.id },
  });

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  if (event.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  if (event.operatorId !== operator.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only update your own events",
    );
  }

  const allowedTransitions = VALID_STATUS_TRANSITIONS[event.status] ?? [];

  if (!allowedTransitions.includes(payload.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot transition from "${event.status}" to "${payload.status}"`,
    );
  }

  const updateData: Prisma.OutageEventUpdateInput = {
    status: payload.status,
  };

  if (payload.status === OutageEventStatus.IN_PROGRESS) {
    updateData.actualStart = new Date();
  }

  if (payload.status === OutageEventStatus.COMPLETED) {
    updateData.actualEnd = new Date();
  }

  const updatedEvent = await prisma.outageEvent.update({
    where: { id: params.id },
    data: updateData,
    include: {
      operator: {
        include: {
          user: {
            omit: { password: true },
          },
        },
      },
    },
  });

  return updatedEvent;
};

const softDeleteEvent = async (
  params: ISoftDeleteEventParams,
  userId: string,
) => {
  const operator = await prisma.operator.findUnique({
    where: { userId },
  });

  if (!operator) {
    throw new AppError(httpStatus.NOT_FOUND, "Operator profile not found");
  }

  const event = await prisma.outageEvent.findUnique({
    where: { id: params.id },
    include: {
      capacityOffers: {
        where: {
          deletedAt: null,
          status: {
            in: [
              OfferStatus.AVAILABLE,
              OfferStatus.PARTIALLY_AVAILABLE,
              OfferStatus.FULLY_ALLOCATED,
            ],
          },
        },
      },
      capacityRequests: {
        where: {
          deletedAt: null,
          status: {
            in: [
              RequestStatus.PENDING,
              RequestStatus.ALLOCATED,
            ],
          },
        },
      },
    },
  });

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  if (event.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  if (event.operatorId !== operator.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only delete your own events",
    );
  }

  if (event.status !== OutageEventStatus.SCHEDULED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot delete event with status "${event.status}". Only SCHEDULED events can be deleted.`,
    );
  }

  if (event.capacityOffers.length > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot delete event with active capacity offers",
    );
  }

  if (event.capacityRequests.length > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot delete event with active capacity requests",
    );
  }

  const deletedEvent = await prisma.outageEvent.update({
    where: { id: params.id },
    data: {
      deletedAt: new Date(),
      status: OutageEventStatus.CANCELLED,
    },
  });

  return deletedEvent;
};

export const EventServices = {
  createEvent,
  getAllEvents,
  getMyEvents,
  getAvailableEvents,
  getEventById,
  updateEvent,
  updateEventStatus,
  softDeleteEvent,
};
