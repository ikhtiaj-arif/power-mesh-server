import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { DeliveryServices } from "./delivery.service";
import type { RequestUser } from "../../app/middleware/checkAuth";
import { AppError } from "../../utils/appError";

const getDeliveryByReservation = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as unknown as RequestUser;

    if (!user) {
      throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
    }

    const reservationId = req.params.reservationId as string;
    const result = await DeliveryServices.getDeliveryByReservation(
      { reservationId },
      user,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Delivery fetched successfully",
      data: result,
    });
  },
);

const providerCheckIn = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const reservationId = req.params.reservationId as string;
  const result = await DeliveryServices.providerCheckIn(
    { reservationId },
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Provider check-in successful",
    data: result,
  });
});

const providerReport = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const reservationId = req.params.reservationId as string;
  const result = await DeliveryServices.providerReport(
    { reservationId },
    req.body,
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Delivery report submitted successfully",
    data: result,
  });
});

const consumerConfirm = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const reservationId = req.params.reservationId as string;
  const result = await DeliveryServices.consumerConfirm(
    { reservationId },
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Delivery confirmed successfully",
    data: result,
  });
});

const consumerDispute = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const reservationId = req.params.reservationId as string;
  const result = await DeliveryServices.consumerDispute(
    { reservationId },
    req.body,
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Delivery dispute submitted successfully",
    data: result,
  });
});

export const DeliveryController = {
  getDeliveryByReservation,
  providerCheckIn,
  providerReport,
  consumerConfirm,
  consumerDispute,
};