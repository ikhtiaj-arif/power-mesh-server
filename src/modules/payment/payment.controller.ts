import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { PaymentServices } from "./payment.service";
import type { RequestUser } from "../../app/middleware/checkAuth";
import { AppError } from "../../utils/appError";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const result = await PaymentServices.initiatePayment(req.body, user.userId);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Payment initiated successfully",
    data: result,
  });
});

const handleBkashCallback = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as never;
  const result = await PaymentServices.handleBkashCallback(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment callback processed",
    data: result,
  });
});

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const id = req.params.id as string;
  const result = await PaymentServices.getPaymentById({ id }, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment fetched successfully",
    data: result,
  });
});

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const query = req.query;
  const result = await PaymentServices.getMyPayments(
    query as never,
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your payments fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const result = await PaymentServices.getAllPayments(query as never);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

export const PaymentController = {
  initiatePayment,
  handleBkashCallback,
  getPaymentById,
  getMyPayments,
  getAllPayments,
};
