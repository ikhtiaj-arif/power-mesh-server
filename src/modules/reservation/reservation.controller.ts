import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { ReservationServices } from "./reservation.service";
import type { RequestUser } from "../../app/middleware/checkAuth";
import { AppError } from "../../utils/appError";

const createReservation = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const result = await ReservationServices.createReservation(
    req.body,
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Reservation created successfully",
    data: result,
  });
});

const getAllReservations = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const result = await ReservationServices.getAllReservations(query as never);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reservations fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getMyReservations = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const query = req.query;
  const result = await ReservationServices.getMyReservations(
    query as never,
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your reservations fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getProviderReservations = catchAsync(
  async (req: Request, res: Response) => {
    const providerId = req.params.providerId as string;
    const query = req.query;
    const result = await ReservationServices.getProviderReservations(
      { providerId },
      query as never,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Provider reservations fetched successfully",
      data: result.data,
      meta: result.meta,
    });
  },
);

const getReservationById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await ReservationServices.getReservationById({ id });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reservation fetched successfully",
    data: result,
  });
});

const cancelReservation = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const id = req.params.id as string;
  const result = await ReservationServices.cancelReservation(
    { id },
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reservation cancelled successfully",
    data: result,
  });
});

export const ReservationController = {
  createReservation,
  getAllReservations,
  getMyReservations,
  getProviderReservations,
  getReservationById,
  cancelReservation,
};
