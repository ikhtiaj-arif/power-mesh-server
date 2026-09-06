import httpStatus from "http-status";
import {
  DeliveryStatus,
  IncidentStatus,
  IncidentType,
  ReservationStatus,
  UserRole,
} from "../../../prisma/generated/prisma/enums";
import { prisma } from "../../app/lib/primsa";
import type { RequestUser } from "../../app/middleware/checkAuth";
import { AppError } from "../../utils/appError";
import type {
  IConsumerConfirmParams,
  IConsumerDisputeParams,
  IConsumerDisputePayload,
  IGetDeliveryParams,
  IProviderCheckInParams,
  IProviderReportParams,
  IProviderReportPayload,
} from "./delivery.interface";

const DELIVERY_WINDOW_STATUSES: ReservationStatus[] = [
  ReservationStatus.PAYMENT_COMPLETED,
  ReservationStatus.DELIVERY_PENDING,
];

const getDeliveryByReservation = async (params: IGetDeliveryParams, user: RequestUser) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: params.reservationId, deletedAt: null },
    include: {
      consumer: true,
      provider: true,
      delivery: true,
      offer: {
        include: {
          event: true,
        },
      },
    },
  });

  if (!reservation) {
    throw new AppError(httpStatus.NOT_FOUND, "Reservation not found");
  }

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.OPERATOR) {
    const consumer = await prisma.consumer.findUnique({
      where: { userId: user.userId },
    });
    const provider = await prisma.provider.findUnique({
      where: { userId: user.userId },
    });

    const isOwner =
      (consumer !== null && consumer.id === reservation.consumerId) ||
      (provider !== null && provider.id === reservation.providerId);

    if (!isOwner) {
      throw new AppError(httpStatus.FORBIDDEN, "You do not have access to this delivery");
    }
  }

  return reservation;
};

const providerCheckIn = async (params: IProviderCheckInParams, userId: string) => {
  const provider = await prisma.provider.findUnique({
    where: { userId },
  });

  if (!provider) {
    throw new AppError(httpStatus.NOT_FOUND, "Provider profile not found");
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.reservationId, deletedAt: null },
  });

  if (!reservation) {
    throw new AppError(httpStatus.NOT_FOUND, "Reservation not found");
  }

  if (reservation.providerId !== provider.id) {
    throw new AppError(httpStatus.FORBIDDEN, "You can only check in to your own reservations");
  }

  if (!DELIVERY_WINDOW_STATUSES.includes(reservation.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot check in to reservation with status "${reservation.status}"`,
    );
  }

  const delivery = await prisma.$transaction(async (tx) => {
    const upserted = await tx.delivery.upsert({
      where: { reservationId: reservation.id },
      update: {
        confirmedByProvider: userId,
        providerConfirmedAt: new Date(),
        status: DeliveryStatus.PENDING_CHECKIN,
      },
      create: {
        reservationId: reservation.id,
        confirmedByProvider: userId,
        providerConfirmedAt: new Date(),
        status: DeliveryStatus.PENDING_CHECKIN,
      },
      include: { reservation: true },
    });

    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.DELIVERY_PENDING,
        providerCheckinAt: new Date(),
      },
    });

    return upserted;
  });

  return delivery;
};

const providerReport = async (
  params: IProviderReportParams,
  payload: IProviderReportPayload,
  userId: string,
) => {
  const provider = await prisma.provider.findUnique({
    where: { userId },
  });

  if (!provider) {
    throw new AppError(httpStatus.NOT_FOUND, "Provider profile not found");
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.reservationId, deletedAt: null },
  });

  if (!reservation) {
    throw new AppError(httpStatus.NOT_FOUND, "Reservation not found");
  }

  if (reservation.providerId !== provider.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only submit delivery reports for your own reservations",
    );
  }

  if (!DELIVERY_WINDOW_STATUSES.includes(reservation.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot submit delivery report for reservation with status "${reservation.status}"`,
    );
  }

  const delivery = await prisma.delivery.upsert({
    where: { reservationId: reservation.id },
    update: {
      actualDeliveredKw: payload.actualDeliveredKw,
    },
    create: {
      reservationId: reservation.id,
      actualDeliveredKw: payload.actualDeliveredKw,
      status: DeliveryStatus.PENDING_CHECKIN,
    },
    include: { reservation: true },
  });

  return delivery;
};

const consumerConfirm = async (params: IConsumerConfirmParams, userId: string) => {
  const consumer = await prisma.consumer.findUnique({
    where: { userId },
  });

  if (!consumer) {
    throw new AppError(httpStatus.NOT_FOUND, "Consumer profile not found");
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.reservationId, deletedAt: null },
    include: {
      payment: true,
      delivery: true,
    },
  });

  if (!reservation) {
    throw new AppError(httpStatus.NOT_FOUND, "Reservation not found");
  }

  if (reservation.consumerId !== consumer.id) {
    throw new AppError(httpStatus.FORBIDDEN, "You can only confirm your own reservations");
  }

  if (!DELIVERY_WINDOW_STATUSES.includes(reservation.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot confirm delivery for reservation with status "${reservation.status}"`,
    );
  }

  const delivery = reservation.delivery;

  if (delivery === null || delivery.actualDeliveredKw === null) {
    throw new AppError(httpStatus.BAD_REQUEST, "Provider has not submitted a delivery report yet");
  }

  const actualDeliveredKw = delivery.actualDeliveredKw;
  const isFullDelivery = actualDeliveredKw >= reservation.allocatedKw;

  const result = await prisma.$transaction(async (tx) => {
    if (isFullDelivery) {
      await tx.delivery.update({
        where: { id: delivery.id },
        data: {
          status: DeliveryStatus.CONFIRMED,
          confirmedByConsumer: userId,
          consumerConfirmedAt: new Date(),
        },
      });

      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.DELIVERY_CONFIRMED },
      });

      return {
        fullDelivery: true,
        partialDelivery: false,
      };
    }

    const shortageKw = reservation.allocatedKw - actualDeliveredKw;
    const partialRefundAmount = shortageKw * Number(reservation.unitPrice);

    await tx.delivery.update({
      where: { id: delivery.id },
      data: {
        status: DeliveryStatus.PARTIAL,
        confirmedByConsumer: userId,
        consumerConfirmedAt: new Date(),
        partialRefundAmount,
      },
    });

    await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.DELIVERY_PARTIAL },
    });

    await tx.incident.create({
      data: {
        providerId: reservation.providerId,
        reservationId: reservation.id,
        incidentType: IncidentType.PARTIAL_DELIVERY,
        description: `Partial delivery: ${actualDeliveredKw} kW delivered out of ${reservation.allocatedKw} kW allocated for reservation ${reservation.id}`,
        occurredAt: new Date(),
        status: IncidentStatus.OPEN,
      },
    });

    if (reservation.payment !== null) {
      await tx.refund.create({
        data: {
          paymentId: reservation.payment.id,
          reservationId: reservation.id,
          amount: partialRefundAmount,
          reason: `Partial delivery refund: ${shortageKw} kW short at ${Number(
            reservation.unitPrice,
          )} per kWh`,
        },
      });
    }

    return {
      fullDelivery: false,
      partialDelivery: true,
    };
  });

  return {
    reservationId: reservation.id,
    ...result,
  };
};

const consumerDispute = async (
  params: IConsumerDisputeParams,
  payload: IConsumerDisputePayload,
  userId: string,
) => {
  const consumer = await prisma.consumer.findUnique({
    where: { userId },
  });

  if (!consumer) {
    throw new AppError(httpStatus.NOT_FOUND, "Consumer profile not found");
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.reservationId, deletedAt: null },
    include: { delivery: true },
  });

  if (!reservation) {
    throw new AppError(httpStatus.NOT_FOUND, "Reservation not found");
  }

  if (reservation.consumerId !== consumer.id) {
    throw new AppError(httpStatus.FORBIDDEN, "You can only dispute your own reservations");
  }

  if (!DELIVERY_WINDOW_STATUSES.includes(reservation.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot dispute delivery for reservation with status "${reservation.status}"`,
    );
  }

  if (reservation.delivery === null) {
    throw new AppError(httpStatus.BAD_REQUEST, "Provider has not submitted a delivery report yet");
  }

  const delivery = await prisma.delivery.update({
    where: { id: reservation.delivery.id },
    data: {
      status: DeliveryStatus.DISPUTED,
      disputeReason: payload.disputeReason,
    },
    include: { reservation: true },
  });

  return delivery;
};

export const DeliveryServices = {
  getDeliveryByReservation,
  providerCheckIn,
  providerReport,
  consumerConfirm,
  consumerDispute,
};
