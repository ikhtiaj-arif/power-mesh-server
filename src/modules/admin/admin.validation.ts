import z from "zod";
import { ReservationStatus, PaymentStatus } from "../../../prisma/generated/prisma/enums";

const BlockUserZodSchema = z.object({
  isBlocked: z.boolean(),
  reason: z.string().max(500).optional(),
});

const UserIdParamZodSchema = z.object({
  id: z.string().uuid("Invalid user ID"),
});

const EventIdParamZodSchema = z.object({
  id: z.string().uuid("Invalid event ID"),
});

const ReservationIdParamZodSchema = z.object({
  id: z.string().uuid("Invalid reservation ID"),
});

const UpdateReservationStatusZodSchema = z.object({
  status: z.nativeEnum(ReservationStatus),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  resolution: z.string().max(1000).optional(),
});

export const AdminValidation = {
  BlockUserZodSchema,
  UserIdParamZodSchema,
  EventIdParamZodSchema,
  ReservationIdParamZodSchema,
  UpdateReservationStatusZodSchema,
};
