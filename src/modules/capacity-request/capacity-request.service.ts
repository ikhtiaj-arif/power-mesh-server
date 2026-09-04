import httpStatus from "http-status";
import { prisma } from "../../app/lib/primsa";
import { AppError } from "../../utils/appError";
import {
  OutageEventStatus,
  RequestStatus,
} from "../../../prisma/generated/prisma/enums";
import type {
  CapacityRequestWhereInput,
  Prisma,
} from "../../../prisma/generated/prisma";
import type {
  ICreateRequestPayload,
  ICancelRequestParams,
  IGetAllRequestsQuery,
  IGetMyRequestsQuery,
  IGetRequestByIdParams,
  IGetRequestsByEventParams,
  IGetRequestsByEventQuery,
  ISoftDeleteRequestParams,
  IUpdateRequestParams,
  IUpdateRequestPayload,
} from "./capacity-request.interface";

const createRequest = async (
  payload: ICreateRequestPayload,
  userId: string,
) => {
  const consumer = await prisma.consumer.findUnique({
    where: { userId },
  });

  if (!consumer) {
    throw new AppError(httpStatus.NOT_FOUND, "Consumer profile not found");
  }

  const event = await prisma.outageEvent.findUnique({
    where: { id: payload.eventId },
  });

  if (!event || event.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage event not found");
  }

  if (
    event.status !== OutageEventStatus.SCHEDULED &&
    event.status !== OutageEventStatus.CONFIRMED
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot create a request for event with status "${event.status}"`,
    );
  }

  const existingRequest = await prisma.capacityRequest.findFirst({
    where: {
      consumerId: consumer.id,
      eventId: payload.eventId,
      status: { notIn: [RequestStatus.CANCELLED, RequestStatus.REJECTED] },
      deletedAt: null,
    },
  });

  if (existingRequest) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You already have an active request for this event",
    );
  }

  const request = await prisma.capacityRequest.create({
    data: {
      consumerId: consumer.id,
      eventId: payload.eventId,
      requestedKw: payload.requestedKw,
      maxPricePerKwh: payload.maxPricePerKwh,
      priorityTier: payload.priorityTier,
    },
    include: {
      consumer: {
        include: {
          user: {
            omit: { password: true },
          },
        },
      },
      event: true,
    },
  });

  return request;
};

const getAllRequests = async (query: IGetAllRequestsQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: CapacityRequestWhereInput[] = [];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        {
          event: {
            notes: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          consumer: {
            organizationName: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          consumer: {
            user: {
              email: {
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

  if (query.priorityTier) {
    andConditions.push({ priorityTier: query.priorityTier });
  }

  if (query.eventId) {
    andConditions.push({ eventId: query.eventId });
  }

  if (query.consumerId) {
    andConditions.push({ consumerId: query.consumerId });
  }

  andConditions.push({ deletedAt: null });

  const where: Prisma.CapacityRequestWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [allRequests, totalRequestCount] = await Promise.all([
    prisma.capacityRequest.findMany({
      where,
      take: limit,
      skip,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        consumer: {
          include: {
            user: {
              omit: { password: true },
            },
          },
        },
        event: true,
      },
    }),
    prisma.capacityRequest.count({ where }),
  ]);

  return {
    data: allRequests,
    meta: {
      page,
      limit,
      total: totalRequestCount,
      totalPages: Math.ceil(totalRequestCount / limit),
    },
  };
};

const getMyRequests = async (
  query: IGetMyRequestsQuery,
  userId: string,
) => {
  const consumer = await prisma.consumer.findUnique({
    where: { userId },
  });

  if (!consumer) {
    throw new AppError(httpStatus.NOT_FOUND, "Consumer profile not found");
  }

  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: CapacityRequestWhereInput[] = [];

  andConditions.push({ consumerId: consumer.id });
  andConditions.push({ deletedAt: null });

  if (query.status) {
    andConditions.push({ status: query.status });
  }

  if (query.priorityTier) {
    andConditions.push({ priorityTier: query.priorityTier });
  }

  const where: Prisma.CapacityRequestWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [myRequests, totalRequestCount] = await Promise.all([
    prisma.capacityRequest.findMany({
      where,
      take: limit,
      skip,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        event: true,
      },
    }),
    prisma.capacityRequest.count({ where }),
  ]);

  return {
    data: myRequests,
    meta: {
      page,
      limit,
      total: totalRequestCount,
      totalPages: Math.ceil(totalRequestCount / limit),
    },
  };
};

const getRequestsByEvent = async (
  params: IGetRequestsByEventParams,
  query: IGetRequestsByEventQuery,
) => {
  const event = await prisma.outageEvent.findUnique({
    where: { id: params.eventId },
  });

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage event not found");
  }

  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "priorityTier";
  const sortOrder = query.sortOrder ? query.sortOrder : "asc";

  const andConditions: CapacityRequestWhereInput[] = [];

  andConditions.push({ eventId: params.eventId });
  andConditions.push({ deletedAt: null });

  if (query.status) {
    andConditions.push({ status: query.status });
  }

  const where: Prisma.CapacityRequestWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [requests, totalRequestCount] = await Promise.all([
    prisma.capacityRequest.findMany({
      where,
      take: limit,
      skip,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        consumer: {
          include: {
            user: {
              omit: { password: true },
            },
          },
        },
      },
    }),
    prisma.capacityRequest.count({ where }),
  ]);

  return {
    data: requests,
    meta: {
      page,
      limit,
      total: totalRequestCount,
      totalPages: Math.ceil(totalRequestCount / limit),
    },
  };
};

const getRequestById = async (params: IGetRequestByIdParams) => {
  const request = await prisma.capacityRequest.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      consumer: {
        include: {
          user: {
            omit: { password: true },
          },
        },
      },
      event: true,
      reservations: true,
    },
  });

  if (!request) {
    throw new AppError(httpStatus.NOT_FOUND, "Request not found");
  }

  return request;
};

const updateRequest = async (
  params: IUpdateRequestParams,
  payload: IUpdateRequestPayload,
  userId: string,
) => {
  const consumer = await prisma.consumer.findUnique({
    where: { userId },
  });

  if (!consumer) {
    throw new AppError(httpStatus.NOT_FOUND, "Consumer profile not found");
  }

  const request = await prisma.capacityRequest.findUnique({
    where: { id: params.id },
  });

  if (!request) {
    throw new AppError(httpStatus.NOT_FOUND, "Request not found");
  }

  if (request.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Request not found");
  }

  if (request.consumerId !== consumer.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only update your own requests",
    );
  }

  if (request.status !== RequestStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot update request with status "${request.status}"`,
    );
  }

  const updateData: Prisma.CapacityRequestUpdateInput = {};

  if (payload.requestedKw !== undefined) {
    updateData.requestedKw = payload.requestedKw;
  }
  if (payload.maxPricePerKwh !== undefined) {
    updateData.maxPricePerKwh = payload.maxPricePerKwh;
  }
  if (payload.priorityTier !== undefined) {
    updateData.priorityTier = payload.priorityTier;
  }

  const updatedRequest = await prisma.capacityRequest.update({
    where: { id: params.id },
    data: updateData,
    include: {
      consumer: {
        include: {
          user: {
            omit: { password: true },
          },
        },
      },
      event: true,
    },
  });

  return updatedRequest;
};

const cancelRequest = async (
  params: ICancelRequestParams,
  userId: string,
) => {
  const consumer = await prisma.consumer.findUnique({
    where: { userId },
  });

  if (!consumer) {
    throw new AppError(httpStatus.NOT_FOUND, "Consumer profile not found");
  }

  const request = await prisma.capacityRequest.findUnique({
    where: { id: params.id },
  });

  if (!request) {
    throw new AppError(httpStatus.NOT_FOUND, "Request not found");
  }

  if (request.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Request not found");
  }

  if (request.consumerId !== consumer.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only cancel your own requests",
    );
  }

  if (request.status !== RequestStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot cancel request with status "${request.status}"`,
    );
  }

  const cancelledRequest = await prisma.capacityRequest.update({
    where: { id: params.id },
    data: { status: RequestStatus.CANCELLED },
  });

  return cancelledRequest;
};

const softDeleteRequest = async (
  params: ISoftDeleteRequestParams,
  userId: string,
) => {
  const consumer = await prisma.consumer.findUnique({
    where: { userId },
  });

  if (!consumer) {
    throw new AppError(httpStatus.NOT_FOUND, "Consumer profile not found");
  }

  const request = await prisma.capacityRequest.findUnique({
    where: { id: params.id },
  });

  if (!request) {
    throw new AppError(httpStatus.NOT_FOUND, "Request not found");
  }

  if (request.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Request not found");
  }

  if (request.consumerId !== consumer.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only delete your own requests",
    );
  }

  if (request.status !== RequestStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot delete request with status "${request.status}"`,
    );
  }

  const deletedRequest = await prisma.capacityRequest.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), status: RequestStatus.CANCELLED },
  });

  return deletedRequest;
};

export const CapacityRequestServices = {
  createRequest,
  getAllRequests,
  getMyRequests,
  getRequestsByEvent,
  getRequestById,
  updateRequest,
  cancelRequest,
  softDeleteRequest,
};
