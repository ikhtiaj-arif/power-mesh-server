import httpStatus from "http-status";
import crypto from "crypto";
import { prisma } from "../../app/lib/primsa";
import { bkash } from "../../app/lib/bkash";
import config from "../../app/config";
import { AppError } from "../../utils/appError";
import type { RequestUser } from "../../app/middleware/checkAuth";
import {
  AuditAction,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
  UserRole,
  WebhookStatus,
} from "../../../prisma/generated/prisma/enums";
import type {
  Prisma,
  PaymentWhereInput,
} from "../../../prisma/generated/prisma";
import type {
  IBkashCallbackQuery,
  IGetAllPaymentsQuery,
  IGetMyPaymentsQuery,
  IInitiatePaymentPayload,
  IPaymentIdParams,
} from "./payment.interface";

const generateMerchantInvoiceNumber = (reservationId: string): string => {
  const shortId = reservationId.replace(/-/g, "").slice(0, 12);
  const suffix = Date.now().toString(36).slice(-6).toUpperCase();
  return `PM-${shortId}-${suffix}`;
};

const resolveConsumer = async (userId: string) => {
  const consumer = await prisma.consumer.findUnique({
    where: { userId },
  });

  if (!consumer) {
    throw new AppError(httpStatus.NOT_FOUND, "Consumer profile not found");
  }

  return consumer;
};

const initiatePayment = async (
  payload: IInitiatePaymentPayload,
  userId: string,
) => {
  const consumer = await resolveConsumer(userId);

  const reservation = await prisma.reservation.findUnique({
    where: { id: payload.reservationId },
    include: { offer: true },
  });

  if (!reservation || reservation.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Reservation not found");
  }

  if (reservation.consumerId !== consumer.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only pay for your own reservations",
    );
  }

  if (
    reservation.status !== ReservationStatus.ALLOCATED &&
    reservation.status !== ReservationStatus.PAYMENT_PENDING
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot initiate payment for reservation with status "${reservation.status}"`,
    );
  }

  const existingPayment = await prisma.payment.findUnique({
    where: { reservationId: reservation.id },
  });

  if (
    existingPayment &&
    (existingPayment.gatewayStatus === PaymentStatus.COMPLETED ||
      existingPayment.gatewayStatus === PaymentStatus.REFUNDED)
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This reservation has already been settled",
    );
  }

  if (
    existingPayment &&
    existingPayment.gatewayStatus === PaymentStatus.PROCESSING
  ) {
    throw new AppError(
      httpStatus.CONFLICT,
      "A payment is already in progress for this reservation",
    );
  }

  const amount = Number(reservation.totalAmount);
  const merchantInvoiceNumber = generateMerchantInvoiceNumber(reservation.id);
  const payerReference = consumer.contactPhone || consumer.id;

  let payment;
  let bkashURL: string;
  let paymentID: string;

  try {
    const prepared = await prisma.$transaction(async (tx) => {
      if (existingPayment) {
        const reset = await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            gatewayStatus: PaymentStatus.PROCESSING,
            merchantInvoiceNumber,
            idempotencyKey: crypto.randomUUID(),
            completedAt: null,
            webhookStatus: WebhookStatus.PENDING,
            webhookReceivedAt: null,
            webhookProcessedAt: null,
          },
        });

        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: ReservationStatus.PAYMENT_PENDING,
            paymentStatus: PaymentStatus.PROCESSING,
          },
        });

        return reset;
      }

      const created = await tx.payment.create({
        data: {
          reservationId: reservation.id,
          amount,
          currency: "BDT",
          gatewayStatus: PaymentStatus.PROCESSING,
          merchantInvoiceNumber,
          idempotencyKey: crypto.randomUUID(),
          webhookStatus: WebhookStatus.PENDING,
        },
      });

      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.PAYMENT_PENDING,
          paymentStatus: PaymentStatus.PROCESSING,
        },
      });

      return created;
    });

    const bkashPayment = await bkash.createPayment({
      amount,
      merchantInvoiceNumber,
      payerReference,
      callbackUrl: config.bkash_callback_url,
    });

    payment = await prisma.payment.update({
      where: { id: prepared.id },
      data: { gatewayId: bkashPayment.paymentID },
    });

    bkashURL = bkashPayment.bkashURL;
    paymentID = bkashPayment.paymentID;
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "P2002") {
      throw new AppError(
        httpStatus.CONFLICT,
        "This reservation already has an active payment",
      );
    }
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `Failed to initiate bKash payment: ${
        err.message || "unknown gateway error"
      }`,
    );
  }

  return {
    payment,
    bkashURL,
    paymentID,
  };
};

const handleBkashCallback = async (query: IBkashCallbackQuery) => {
  const paymentID = query.paymentID;

  if (!paymentID) {
    throw new AppError(httpStatus.BAD_REQUEST, "Missing payment ID in callback");
  }

  const payment = await prisma.payment.findUnique({
    where: { gatewayId: paymentID },
    include: {
      reservation: {
        include: { offer: true },
      },
    },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment record not found");
  }

  if (
    payment.gatewayStatus === PaymentStatus.COMPLETED ||
    payment.gatewayStatus === PaymentStatus.REFUNDED
  ) {
    return { status: payment.gatewayStatus, alreadyProcessed: true };
  }

  if (query.status !== "success") {
    const failed = await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          gatewayStatus: PaymentStatus.FAILED,
          webhookStatus: WebhookStatus.RECEIVED,
          webhookProcessedAt: new Date(),
        },
      });

      await tx.reservation.update({
        where: { id: payment.reservationId },
        data: {
          status: ReservationStatus.ALLOCATED,
          paymentStatus: PaymentStatus.FAILED,
        },
      });

      return tx.payment.findUnique({ where: { id: payment.id } });
    });

    return { status: PaymentStatus.FAILED, payment: failed };
  }

  let executed;
  try {
    executed = await bkash.executePayment(paymentID);
  } catch (error) {
    const err = error as { message?: string };
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        gatewayStatus: PaymentStatus.FAILED,
        webhookStatus: WebhookStatus.FAILED,
        webhookProcessedAt: new Date(),
      },
    });
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `Failed to execute bKash payment: ${err.message || "unknown error"}`,
    );
  }

  if (executed.transactionStatus !== "Completed") {
    const failed = await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          gatewayStatus: PaymentStatus.FAILED,
          webhookStatus: WebhookStatus.RECEIVED,
          webhookProcessedAt: new Date(),
        },
      });

      await tx.reservation.update({
        where: { id: payment.reservationId },
        data: {
          status: ReservationStatus.ALLOCATED,
          paymentStatus: PaymentStatus.FAILED,
        },
      });

      return tx.payment.findUnique({ where: { id: payment.id } });
    });

    return { status: PaymentStatus.FAILED, payment: failed };
  }

  const paymentMethod =
    executed.transactionType === "Cash Out"
      ? PaymentMethod.CASH_OUT
      : PaymentMethod.SEND_MONEY;

  const consumer = await prisma.consumer.findUnique({
    where: { id: payment.reservation.consumerId },
    select: { userId: true },
  });

  const completed = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        gatewayStatus: PaymentStatus.COMPLETED,
        paymentMethod,
        completedAt: new Date(),
        webhookStatus: WebhookStatus.PROCESSED,
        webhookReceivedAt: payment.webhookReceivedAt ?? new Date(),
        webhookProcessedAt: new Date(),
      },
    });

    await tx.reservation.update({
      where: { id: payment.reservationId },
      data: {
        status: ReservationStatus.PAYMENT_COMPLETED,
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: consumer?.userId ?? null,
        entityType: "payment",
        entityId: payment.id,
        action: AuditAction.PAY,
        newValues: {
          gatewayId: paymentID,
          trxID: executed.trxID ?? null,
          amount: executed.amount ?? payment.amount,
        },
        ipAddress: null,
        userAgent: null,
      },
    });

    return updatedPayment;
  });

  return { status: PaymentStatus.COMPLETED, payment: completed };
};

const getPaymentById = async (
  params: IPaymentIdParams,
  user: RequestUser,
) => {
  const payment = await prisma.payment.findUnique({
    where: { id: params.id },
    include: {
      reservation: {
        include: {
          consumer: {
            include: {
              user: { omit: { password: true } },
            },
          },
          provider: {
            include: {
              user: { omit: { password: true } },
            },
          },
          offer: {
            include: { event: true },
          },
        },
      },
    },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
  }

  if (user.role === UserRole.CONSUMER) {
    const consumer = await prisma.consumer.findUnique({
      where: { userId: user.userId },
    });
    if (!consumer || payment.reservation.consumerId !== consumer.id) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to view this payment",
      );
    }
  }

  return payment;
};

const getMyPayments = async (
  query: IGetMyPaymentsQuery,
  userId: string,
) => {
  const consumer = await resolveConsumer(userId);

  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: PaymentWhereInput[] = [
    { reservation: { consumerId: consumer.id } },
    { deletedAt: null },
  ];

  if (query.gatewayStatus) {
    andConditions.push({ gatewayStatus: query.gatewayStatus });
  }

  const where: Prisma.PaymentWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      take: limit,
      skip,
      orderBy: { [sortBy]: sortOrder },
      include: {
        reservation: {
          include: {
            offer: {
              include: {
                event: true,
                provider: {
                  include: {
                    user: { omit: { password: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    data: payments,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getAllPayments = async (query: IGetAllPaymentsQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: PaymentWhereInput[] = [{ deletedAt: null }];

  if (query.gatewayStatus) {
    andConditions.push({ gatewayStatus: query.gatewayStatus });
  }

  if (query.paymentMethod) {
    andConditions.push({ paymentMethod: query.paymentMethod });
  }

  if (query.webhookStatus) {
    andConditions.push({ webhookStatus: query.webhookStatus });
  }

  if (query.reservationId) {
    andConditions.push({ reservationId: query.reservationId });
  }

  if (query.consumerEmail) {
    andConditions.push({
      reservation: {
        consumer: {
          user: { email: query.consumerEmail },
        },
      },
    });
  }

  const where: Prisma.PaymentWhereInput = {
    AND: andConditions.length > 0 ? andConditions : undefined,
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      take: limit,
      skip,
      orderBy: { [sortBy]: sortOrder },
      include: {
        reservation: {
          include: {
            consumer: {
              include: {
                user: { omit: { password: true } },
              },
            },
            provider: {
              include: {
                user: { omit: { password: true } },
              },
            },
            offer: {
              include: { event: true },
            },
          },
        },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    data: payments,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const PaymentServices = {
  initiatePayment,
  handleBkashCallback,
  getPaymentById,
  getMyPayments,
  getAllPayments,
};
