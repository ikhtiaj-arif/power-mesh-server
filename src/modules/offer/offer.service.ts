import httpStatus from "http-status";
import { prisma } from "../../app/lib/primsa";
import { AppError } from "../../utils/appError";
import {
  OfferStatus,
  ProviderStatus,
  ReservationStatus,
} from "../../../prisma/generated/prisma/enums";
import type {
  CapacityOfferWhereInput,
  Prisma,
} from "../../../prisma/generated/prisma";
import type {
  ICreateOfferPayload,
  IGetAllOffersQuery,
  IGetMyOffersQuery,
  IGetOfferByIdParams,
  IGetOffersByEventParams,
  IGetOffersByEventQuery,
  ISoftDeleteOfferParams,
  IUpdateOfferParams,
  IUpdateOfferPayload,
} from "./offer.interface";

const createOffer = async (
  payload: ICreateOfferPayload,
  providerId: string,
) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) {
    throw new AppError(httpStatus.NOT_FOUND, "Provider profile not found");
  }

  if (provider.status !== ProviderStatus.APPROVED) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only approved providers can create offers",
    );
  }

  const event = await prisma.outageEvent.findUnique({
    where: { id: payload.eventId },
  });

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage event not found");
  }

  if (provider.capacityKw < payload.capacityKw) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Offer capacity exceeds your total provider capacity",
    );
  }

  const existingOffer = await prisma.capacityOffer.findFirst({
    where: {
      providerId,
      eventId: payload.eventId,
      deliveryStart: new Date(payload.deliveryStart),
      deliveryEnd: new Date(payload.deliveryEnd),
      deletedAt: null,
    },
  });

  if (existingOffer) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You already have an offer for this event and time slot",
    );
  }

  const offer = await prisma.capacityOffer.create({
    data: {
      providerId,
      eventId: payload.eventId,
      capacityKw: payload.capacityKw,
      pricePerKwh: payload.pricePerKwh,
      deliveryStart: new Date(payload.deliveryStart),
      deliveryEnd: new Date(payload.deliveryEnd),
    },
    include: {
      provider: {
        include: {
          user: {
            omit: { password: true },
          },
        },
      },
      event: true,
    },
  });

  return offer;
};

const getAllOffers = async (query: IGetAllOffersQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: CapacityOfferWhereInput[] = [];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        {
          event: {
            status: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          event: {
            notes: {
              contains: query.searchTerm,
              mode: "insensitive",
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
          provider: {
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
    andConditions.push({
      status: query.status,
    });
  }

  if (query.eventId) {
    andConditions.push({
      eventId: query.eventId,
    });
  }

  if (query.providerId) {
    andConditions.push({
      providerId: query.providerId,
    });
  }

  if (query.minCapacity !== undefined) {
    andConditions.push({
      capacityKw: { gte: query.minCapacity },
    });
  }

  if (query.maxCapacity !== undefined) {
    andConditions.push({
      capacityKw: { lte: query.maxCapacity },
    });
  }

  andConditions.push({ deletedAt: null });

  const where: Prisma.CapacityOfferWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [allOffers, totalOfferCount] = await Promise.all([
    prisma.capacityOffer.findMany({
      where,
      take: limit,
      skip,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        provider: {
          include: {
            user: {
              omit: { password: true },
            },
          },
        },
        event: true,
      },
    }),
    prisma.capacityOffer.count({ where }),
  ]);

  return {
    data: allOffers,
    meta: {
      page,
      limit,
      total: totalOfferCount,
      totalPages: Math.ceil(totalOfferCount / limit),
    },
  };
};

const getMyOffers = async (
  query: IGetMyOffersQuery,
  providerId: string,
) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: CapacityOfferWhereInput[] = [];

  andConditions.push({ providerId });

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        {
          event: {
            status: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          event: {
            notes: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  if (query.status) {
    andConditions.push({
      status: query.status,
    });
  }

  if (query.eventId) {
    andConditions.push({
      eventId: query.eventId,
    });
  }

  andConditions.push({ deletedAt: null });

  const where: Prisma.CapacityOfferWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [myOffers, totalOfferCount] = await Promise.all([
    prisma.capacityOffer.findMany({
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
    prisma.capacityOffer.count({ where }),
  ]);

  return {
    data: myOffers,
    meta: {
      page,
      limit,
      total: totalOfferCount,
      totalPages: Math.ceil(totalOfferCount / limit),
    },
  };
};

const getOfferById = async (params: IGetOfferByIdParams) => {
  const offer = await prisma.capacityOffer.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      provider: {
        include: {
          user: {
            omit: { password: true },
          },
        },
      },
      event: true,
      reservations: {
        where: {
          status: {
            notIn: [ReservationStatus.CANCELLED, ReservationStatus.REFUNDED],
          },
        },
      },
    },
  });

  if (!offer) {
    throw new AppError(httpStatus.NOT_FOUND, "Offer not found");
  }

  return offer;
};

const updateOffer = async (
  params: IUpdateOfferParams,
  payload: IUpdateOfferPayload,
  providerId: string,
) => {
  const offer = await prisma.capacityOffer.findUnique({
    where: { id: params.id },
  });

  if (!offer) {
    throw new AppError(httpStatus.NOT_FOUND, "Offer not found");
  }

  if (offer.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Offer not found");
  }

  if (offer.providerId !== providerId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only update your own offers",
    );
  }

  if (
    offer.status !== OfferStatus.AVAILABLE &&
    offer.status !== OfferStatus.PARTIALLY_AVAILABLE
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot update offer with status "${offer.status}"`,
    );
  }

  const updateData: Prisma.CapacityOfferUpdateInput = {};

  if (payload.capacityKw !== undefined) {
    updateData.capacityKw = payload.capacityKw;
  }
  if (payload.pricePerKwh !== undefined) {
    updateData.pricePerKwh = payload.pricePerKwh;
  }
  if (payload.deliveryStart !== undefined) {
    updateData.deliveryStart = new Date(payload.deliveryStart);
  }
  if (payload.deliveryEnd !== undefined) {
    updateData.deliveryEnd = new Date(payload.deliveryEnd);
  }
  if (payload.status !== undefined) {
    updateData.status = payload.status;
  }

  const updatedOffer = await prisma.capacityOffer.update({
    where: { id: params.id },
    data: updateData,
    include: {
      provider: {
        include: {
          user: {
            omit: { password: true },
          },
        },
      },
      event: true,
    },
  });

  return updatedOffer;
};

const softDeleteOffer = async (
  params: ISoftDeleteOfferParams,
  providerId: string,
) => {
  const offer = await prisma.capacityOffer.findUnique({
    where: { id: params.id },
    include: {
      reservations: {
        where: {
          status: {
            in: [
              ReservationStatus.ALLOCATED,
              ReservationStatus.PAYMENT_PENDING,
              ReservationStatus.DELIVERY_PENDING,
            ],
          },
        },
      },
    },
  });

  if (!offer) {
    throw new AppError(httpStatus.NOT_FOUND, "Offer not found");
  }

  if (offer.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Offer not found");
  }

  if (offer.providerId !== providerId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only delete your own offers",
    );
  }

  if (offer.reservations.length > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot delete offer with active reservations",
    );
  }

  const deletedOffer = await prisma.capacityOffer.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), status: OfferStatus.CANCELLED },
  });

  return deletedOffer;
};

const getOffersByEvent = async (
  params: IGetOffersByEventParams,
  query: IGetOffersByEventQuery,
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
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: CapacityOfferWhereInput[] = [];

  andConditions.push({ eventId: params.eventId });
  andConditions.push({ deletedAt: null });

  if (query.status) {
    andConditions.push({ status: query.status });
  }

  const where: Prisma.CapacityOfferWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [offers, totalOfferCount] = await Promise.all([
    prisma.capacityOffer.findMany({
      where,
      take: limit,
      skip,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        provider: {
          include: {
            user: {
              omit: { password: true },
            },
          },
        },
      },
    }),
    prisma.capacityOffer.count({ where }),
  ]);

  return {
    data: offers,
    meta: {
      page,
      limit,
      total: totalOfferCount,
      totalPages: Math.ceil(totalOfferCount / limit),
    },
  };
};

export const OfferServices = {
  createOffer,
  getAllOffers,
  getMyOffers,
  getOfferById,
  updateOffer,
  softDeleteOffer,
  getOffersByEvent,
};
