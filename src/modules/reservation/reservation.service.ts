import httpStatus from "http-status";
import crypto from "crypto";
import { prisma } from "../../app/lib/primsa";
import { AppError } from "../../utils/appError";
import {
  OfferStatus,
  RequestStatus,
  ReservationStatus,
} from "../../../prisma/generated/prisma/enums";
import type {
  Prisma,
  ReservationWhereInput,
} from "../../../prisma/generated/prisma";
import type {
  ICancelReservationParams,
  ICreateReservationPayload,
  IGetAllReservationsQuery,
  IGetMyReservationsQuery,
  IGetProviderReservationsParams,
  IGetProviderReservationsQuery,
  IGetReservationByIdParams,
} from "./reservation.interface";

const createReservation = async (
  payload: ICreateReservationPayload,
  userId: string,
) => {
  const consumer = await prisma.consumer.findUnique({
    where: { userId },
  });

  if (!consumer) {
    throw new AppError(httpStatus.NOT_FOUND, "Consumer profile not found");
  }

  const request = await prisma.capacityRequest.findUnique({
    where: { id: payload.requestId },
  });

  if (!request || request.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Capacity request not found");
  }

  if (request.consumerId !== consumer.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only reserve capacity for your own requests",
    );
  }

  if (request.status !== RequestStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot reserve for request with status "${request.status}"`,
    );
  }

  const offer = await prisma.capacityOffer.findUnique({
    where: { id: payload.offerId },
  });

  if (!offer || offer.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Offer not found");
  }

  if (
    offer.status !== OfferStatus.AVAILABLE &&
    offer.status !== OfferStatus.PARTIALLY_AVAILABLE
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Offer is not available for reservation (status "${offer.status}")`,
    );
  }

  if (offer.eventId !== request.eventId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Offer and request must belong to the same outage event",
    );
  }

  const remainingCapacity = offer.capacityKw - offer.reservedKw;

  if (remainingCapacity < request.requestedKw) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Offer does not have enough remaining capacity (remaining ${remainingCapacity} kW)`,
    );
  }

  const allocatedKw = request.requestedKw;
  const unitPrice = Number(offer.pricePerKwh);
  const totalAmount = allocatedKw * unitPrice;
  const newReservedKw = offer.reservedKw + allocatedKw;
  const offerFullyAllocated = newReservedKw >= offer.capacityKw;

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const created = await tx.reservation.create({
        data: {
          offerId: offer.id,
          requestId: request.id,
          consumerId: consumer.id,
          providerId: offer.providerId,
          allocatedKw,
          unitPrice,
          totalAmount,
          deliveryStart: offer.deliveryStart,
          deliveryEnd: offer.deliveryEnd,
          idempotencyKey: crypto.randomUUID(),
          status: ReservationStatus.ALLOCATED,
        },
        include: {
          offer: true,
          request: true,
          consumer: {
            include: {
              user: {
                omit: { password: true },
              },
            },
          },
          provider: {
            include: {
              user: {
                omit: { password: true },
              },
            },
          },
        },
      });

      await tx.capacityOffer.update({
        where: { id: offer.id },
        data: {
          reservedKw: newReservedKw,
          status: offerFullyAllocated
            ? OfferStatus.FULLY_ALLOCATED
            : OfferStatus.PARTIALLY_AVAILABLE,
        },
      });

      await tx.capacityRequest.update({
        where: { id: request.id },
        data: { status: RequestStatus.ALLOCATED },
      });

      return created;
    });

    return reservation;
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      throw new AppError(
        httpStatus.CONFLICT,
        "This request has already been reserved on this offer",
      );
    }
    throw error;
  }
};

const getAllReservations = async (query: IGetAllReservationsQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: ReservationWhereInput[] = [];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
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
        {
          provider: {
            companyName: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          offer: {
            event: {
              notes: {
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

  if (query.paymentStatus) {
    andConditions.push({ paymentStatus: query.paymentStatus });
  }

  if (query.eventId) {
    andConditions.push({ offer: { eventId: query.eventId } });
  }

  andConditions.push({ deletedAt: null });

  const where: Prisma.ReservationWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [reservations, totalReservationCount] = await Promise.all([
    prisma.reservation.findMany({
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
        provider: {
          include: {
            user: {
              omit: { password: true },
            },
          },
        },
        offer: {
          include: {
            event: true,
          },
        },
      },
    }),
    prisma.reservation.count({ where }),
  ]);

  return {
    data: reservations,
    meta: {
      page,
      limit,
      total: totalReservationCount,
      totalPages: Math.ceil(totalReservationCount / limit),
    },
  };
};

const getMyReservations = async (
  query: IGetMyReservationsQuery,
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

  const andConditions: ReservationWhereInput[] = [];

  andConditions.push({ consumerId: consumer.id });
  andConditions.push({ deletedAt: null });

  if (query.status) {
    andConditions.push({ status: query.status });
  }

  const where: Prisma.ReservationWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [reservations, totalReservationCount] = await Promise.all([
    prisma.reservation.findMany({
      where,
      take: limit,
      skip,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        offer: {
          include: {
            event: true,
            provider: {
              include: {
                user: {
                  omit: { password: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.reservation.count({ where }),
  ]);

  return {
    data: reservations,
    meta: {
      page,
      limit,
      total: totalReservationCount,
      totalPages: Math.ceil(totalReservationCount / limit),
    },
  };
};

const getProviderReservations = async (
  params: IGetProviderReservationsParams,
  query: IGetProviderReservationsQuery,
) => {
  const provider = await prisma.provider.findUnique({
    where: { id: params.providerId },
  });

  if (!provider) {
    throw new AppError(httpStatus.NOT_FOUND, "Provider not found");
  }

  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: ReservationWhereInput[] = [];

  andConditions.push({ providerId: provider.id });
  andConditions.push({ deletedAt: null });

  if (query.status) {
    andConditions.push({ status: query.status });
  }

  const where: Prisma.ReservationWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [reservations, totalReservationCount] = await Promise.all([
    prisma.reservation.findMany({
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
        offer: true,
      },
    }),
    prisma.reservation.count({ where }),
  ]);

  return {
    data: reservations,
    meta: {
      page,
      limit,
      total: totalReservationCount,
      totalPages: Math.ceil(totalReservationCount / limit),
    },
  };
};

const getReservationById = async (params: IGetReservationByIdParams) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      offer: {
        include: {
          event: true,
        },
      },
      request: true,
      consumer: {
        include: {
          user: {
            omit: { password: true },
          },
        },
      },
      provider: {
        include: {
          user: {
            omit: { password: true },
          },
        },
      },
    },
  });

  if (!reservation) {
    throw new AppError(httpStatus.NOT_FOUND, "Reservation not found");
  }

  return reservation;
};

const cancelReservation = async (
  params: ICancelReservationParams,
  userId: string,
) => {
  const consumer = await prisma.consumer.findUnique({
    where: { userId },
  });

  if (!consumer) {
    throw new AppError(httpStatus.NOT_FOUND, "Consumer profile not found");
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: {
      offer: true,
      request: true,
    },
  });

  if (!reservation) {
    throw new AppError(httpStatus.NOT_FOUND, "Reservation not found");
  }

  if (reservation.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Reservation not found");
  }

  if (reservation.consumerId !== consumer.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only cancel your own reservations",
    );
  }

  if (
    reservation.status !== ReservationStatus.ALLOCATED &&
    reservation.status !== ReservationStatus.PAYMENT_PENDING
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot cancel reservation with status "${reservation.status}"`,
    );
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.reservation.update({
      where: { id: params.id },
      data: {
        status: ReservationStatus.CANCELLED,
        deletedAt: new Date(),
      },
    });

    const newReservedKw =
      reservation.offer.reservedKw - reservation.allocatedKw;
    const newReserved = Math.max(0, newReservedKw);

    await tx.capacityOffer.update({
      where: { id: reservation.offerId },
      data: {
        reservedKw: newReserved,
        status:
          newReserved > 0
            ? OfferStatus.PARTIALLY_AVAILABLE
            : OfferStatus.AVAILABLE,
      },
    });

    await tx.capacityRequest.update({
      where: { id: reservation.requestId },
      data: { status: RequestStatus.CANCELLED },
    });

    return updated;
  });

  return cancelled;
};

export const ReservationServices = {
  createReservation,
  getAllReservations,
  getMyReservations,
  getProviderReservations,
  getReservationById,
  cancelReservation,
};
