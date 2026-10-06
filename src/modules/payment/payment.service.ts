import crypto from "node:crypto";
import httpStatus from "http-status";
import type Stripe from "stripe";
import { Prisma } from "../../../prisma/generated/prisma/client";
import {
  AuditAction,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
  UserRole,
  WebhookStatus,
} from "../../../prisma/generated/prisma/enums";
import type { PaymentWhereInput } from "../../../prisma/generated/prisma/models";
import config from "../../app/config";
import { bkash } from "../../app/lib/bkash";
import { prisma } from "../../app/lib/primsa";
import { getStripe } from "../../app/lib/stripe";
import type { RequestUser } from "../../app/middleware/checkAuth";
import { AppError } from "../../utils/appError";
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
    include: {
      user: { select: { email: true } },
    },
  });

  if (!consumer) {
    throw new AppError(httpStatus.NOT_FOUND, "Consumer profile not found");
  }

  return consumer;
};

const initiatePayment = async (payload: IInitiatePaymentPayload, userId: string) => {
  const provider = payload.provider ?? "BKASH";
  const consumer = await resolveConsumer(userId);

  const reservation = await prisma.reservation.findUnique({
    where: { id: payload.reservationId },
    include: { offer: true },
  });

  if (!reservation || reservation.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Reservation not found");
  }

  if (reservation.consumerId !== consumer.id) {
    throw new AppError(httpStatus.FORBIDDEN, "You can only pay for your own reservations");
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
    throw new AppError(httpStatus.BAD_REQUEST, "This reservation has already been settled");
  }

  // INITIATED / PROCESSING / FAILED payments are reset so the consumer can
  // retry or switch between bKash and Stripe.

  const amount = Number(reservation.totalAmount);
  const merchantInvoiceNumber = generateMerchantInvoiceNumber(reservation.id);
  const payerReference = consumer.user?.email || consumer.contactPhone || consumer.id;

  let prepared: Prisma.PaymentGetPayload<object>;
  try {
    prepared = await prisma.$transaction(async (tx) => {
      if (existingPayment) {
        const reset = await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            gatewayStatus: PaymentStatus.PROCESSING,
            paymentMethod: provider === "STRIPE" ? PaymentMethod.STRIPE : PaymentMethod.BKASH,
            merchantInvoiceNumber,
            idempotencyKey: crypto.randomUUID(),
            completedAt: null,
            webhookStatus: WebhookStatus.PENDING,
            webhookReceivedAt: null,
            webhookProcessedAt: null,
            gatewayId: null,
            bkashTrxId: null,
            gatewayResponse: Prisma.DbNull,
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
          paymentMethod: provider === "STRIPE" ? PaymentMethod.STRIPE : PaymentMethod.BKASH,
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
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "P2002") {
      throw new AppError(httpStatus.CONFLICT, "This reservation already has an active payment");
    }
    throw error;
  }

  if (provider === "STRIPE") {
    return initiateStripeCheckout({
      payment: prepared,
      reservationId: reservation.id,
      amount,
      merchantInvoiceNumber,
      payerReference,
      consumerEmail: consumer.user?.email,
    });
  }

  return initiateBkashCheckout({
    payment: prepared,
    amount,
    merchantInvoiceNumber,
    payerReference,
  });
};

const initiateBkashCheckout = async (input: {
  payment: Prisma.PaymentGetPayload<object>;
  amount: number;
  merchantInvoiceNumber: string;
  payerReference: string;
}) => {
  try {
    const bkashPayment = await bkash.createPayment({
      amount: input.amount,
      merchantInvoiceNumber: input.merchantInvoiceNumber,
      payerReference: input.payerReference,
      callbackUrl: config.bkash_callback_url,
    });

    const payment = await prisma.payment.update({
      where: { id: input.payment.id },
      data: {
        gatewayId: bkashPayment.paymentID,
        payerReference: input.payerReference,
        paymentMethod: PaymentMethod.BKASH,
        gatewayResponse: bkashPayment as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      payment,
      provider: "BKASH" as const,
      checkoutURL: bkashPayment.bkashURL,
      bkashURL: bkashPayment.bkashURL,
      paymentID: bkashPayment.paymentID,
    };
  } catch (error) {
    const err = error as { message?: string };
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `Failed to initiate bKash payment: ${err.message || "unknown gateway error"}`,
    );
  }
};

const initiateStripeCheckout = async (input: {
  payment: Prisma.PaymentGetPayload<object>;
  reservationId: string;
  amount: number;
  merchantInvoiceNumber: string;
  payerReference: string;
  consumerEmail?: string;
}) => {
  if (!config.stripe_secret_key) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Stripe is not configured on this server",
    );
  }

  try {
    const stripe = getStripe();
    // Ledger amount stays BDT. Stripe Checkout settles in USD (test/live accounts
    // enforce a ~$0.50 minimum when presenting exotic currencies like BDT).
    const BDT_PER_USD = 110;
    const usdCents = Math.max(50, Math.round((input.amount / BDT_PER_USD) * 100));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ...(input.consumerEmail ? { customer_email: input.consumerEmail } : {}),
      client_reference_id: input.reservationId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: usdCents,
            product_data: {
              name: `PowerMesh reservation ${input.reservationId.slice(0, 8)}`,
              description: `BDT ${input.amount.toFixed(2)} · invoice ${input.merchantInvoiceNumber}`,
            },
          },
        },
      ],
      metadata: {
        paymentId: input.payment.id,
        reservationId: input.reservationId,
        merchantInvoiceNumber: input.merchantInvoiceNumber,
        amountBdt: String(input.amount),
      },
      success_url: `${config.frontend_url}/my-payments?status=success&provider=stripe`,
      cancel_url: `${config.frontend_url}/my-payments?status=cancel&provider=stripe`,
    });

    if (!session.url) {
      throw new AppError(httpStatus.BAD_GATEWAY, "Stripe did not return a checkout URL");
    }

    const payment = await prisma.payment.update({
      where: { id: input.payment.id },
      data: {
        gatewayId: session.id,
        payerReference: input.payerReference,
        paymentMethod: PaymentMethod.STRIPE,
        gatewayResponse: session as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      payment,
      provider: "STRIPE" as const,
      checkoutURL: session.url,
      sessionId: session.id,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const err = error as { message?: string };
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `Failed to initiate Stripe payment: ${err.message || "unknown gateway error"}`,
    );
  }
};

const handleBkashCallback = async (query: IBkashCallbackQuery) => {
  const transactionResult = await prisma.$transaction(
    async (tx) => {
      const paymentID = query.paymentID;
      const status = query.status;

      if (!paymentID) {
        throw new AppError(httpStatus.BAD_REQUEST, "Payment ID missing in callback");
      }

      if (!status) {
        throw new AppError(httpStatus.BAD_REQUEST, "Payment status missing in callback");
      }

      let executedPaymentResult: Awaited<ReturnType<typeof bkash.executePayment>>;
      try {
        executedPaymentResult = await bkash.executePayment(paymentID);
      } catch (error) {
        const err = error as { message?: string };
        throw new AppError(
          httpStatus.BAD_GATEWAY,
          `Failed to execute bKash payment: ${err.message || "unknown error"}`,
        );
      }

      if (status === "success") {
        const payment = await tx.payment.findUnique({
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

        const paymentMethod =
          executedPaymentResult.transactionType === "Cash Out"
            ? PaymentMethod.CASH_OUT
            : PaymentMethod.SEND_MONEY;

        const consumer = await tx.consumer.findUnique({
          where: { id: payment.reservation.consumerId },
          select: { userId: true },
        });

        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            gatewayStatus: PaymentStatus.COMPLETED,
            paymentMethod,
            bkashTrxId: executedPaymentResult.trxID ?? null,
            paidAt: new Date(),
            completedAt: new Date(),
            gatewayResponse: executedPaymentResult as unknown as Prisma.InputJsonValue,
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
              trxID: executedPaymentResult.trxID ?? null,
              amount: executedPaymentResult.amount ?? payment.amount,
            },
            ipAddress: null,
            userAgent: null,
          },
        });

        return {
          status: PaymentStatus.COMPLETED,
          payment: updatedPayment,
          redirectUrl: `${config.frontend_url}/my-payments?status=success`,
        };
      }

      const failed = await tx.payment.findUnique({
        where: { gatewayId: paymentID },
      });

      if (failed) {
        await tx.payment.update({
          where: { id: failed.id },
          data: {
            gatewayStatus: PaymentStatus.FAILED,
            gatewayResponse: executedPaymentResult as unknown as Prisma.InputJsonValue,
            webhookStatus: WebhookStatus.RECEIVED,
            webhookProcessedAt: new Date(),
          },
        });

        await tx.reservation.update({
          where: { id: failed.reservationId },
          data: {
            status: ReservationStatus.ALLOCATED,
            paymentStatus: PaymentStatus.FAILED,
          },
        });
      }

      return {
        status: PaymentStatus.FAILED,
        redirectUrl: `${config.frontend_url}/my-payments?status=${status}`,
      };
    },
    { maxWait: 5000, timeout: 20000 },
  );

  return transactionResult;
};

const getPaymentById = async (params: IPaymentIdParams, user: RequestUser) => {
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
      throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to view this payment");
    }
  }

  return payment;
};

const getMyPayments = async (query: IGetMyPaymentsQuery, userId: string) => {
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

  const where: Prisma.PaymentWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

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

  const where: Prisma.PaymentWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

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

const markStripePaymentCompleted = async (session: Stripe.Checkout.Session) => {
  const gatewayId = session.id;

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { gatewayId },
      include: {
        reservation: true,
      },
    });

    if (!payment) {
      throw new AppError(httpStatus.NOT_FOUND, "Payment record not found for Stripe session");
    }

    if (payment.gatewayStatus === PaymentStatus.COMPLETED) {
      return payment;
    }

    const consumer = await tx.consumer.findUnique({
      where: { id: payment.reservation.consumerId },
      select: { userId: true },
    });

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        gatewayStatus: PaymentStatus.COMPLETED,
        paymentMethod: PaymentMethod.STRIPE,
        paidAt: new Date(),
        completedAt: new Date(),
        gatewayResponse: session as unknown as Prisma.InputJsonValue,
        webhookStatus: WebhookStatus.PROCESSED,
        webhookReceivedAt: new Date(),
        webhookProcessedAt: new Date(),
        bkashTrxId: typeof session.payment_intent === "string" ? session.payment_intent : null,
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
          provider: "STRIPE",
          gatewayId,
          amount: session.amount_total != null ? session.amount_total / 100 : payment.amount,
          currency: session.currency ?? payment.currency,
        },
        ipAddress: null,
        userAgent: null,
      },
    });

    return updatedPayment;
  });
};

const markStripePaymentFailed = async (session: Stripe.Checkout.Session) => {
  const gatewayId = session.id;

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { gatewayId },
    });

    if (!payment) {
      return null;
    }

    if (
      payment.gatewayStatus === PaymentStatus.COMPLETED ||
      payment.gatewayStatus === PaymentStatus.REFUNDED
    ) {
      return payment;
    }

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        gatewayStatus: PaymentStatus.FAILED,
        paymentMethod: PaymentMethod.STRIPE,
        gatewayResponse: session as unknown as Prisma.InputJsonValue,
        webhookStatus: WebhookStatus.RECEIVED,
        webhookReceivedAt: new Date(),
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

    return updated;
  });
};

const handleStripeWebhook = async (rawBody: Buffer, signature: string | undefined) => {
  if (!config.stripe_webhook_secret) {
    throw new AppError(httpStatus.SERVICE_UNAVAILABLE, "Stripe webhook secret is not configured");
  }

  if (!signature) {
    throw new AppError(httpStatus.BAD_REQUEST, "Missing Stripe-Signature header");
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe_webhook_secret);
  } catch (error) {
    const err = error as { message?: string };
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Stripe webhook signature verification failed: ${err.message || "invalid signature"}`,
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid" || session.status === "complete") {
        await markStripePaymentCompleted(session);
      }
      break;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await markStripePaymentFailed(session);
      break;
    }
    default:
      break;
  }

  return { received: true, type: event.type };
};

export const PaymentServices = {
  initiatePayment,
  handleBkashCallback,
  handleStripeWebhook,
  getPaymentById,
  getMyPayments,
  getAllPayments,
};
