import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { UserServices } from "./user.service";
import type { RequestUser } from "../../app/middleware/checkAuth";
import { AppError } from "../../utils/appError";

const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "User information is missing in the request",
    );
  }

  const result = await UserServices.getMe(user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile fetched successfully",
    data: result,
  });
});

const updateMe = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "User information is missing in the request",
    );
  }

  const result = await UserServices.updateMe(req.body, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile updated successfully",
    data: result,
  });
});

export const UserController = {
  getMe,
  updateMe,
};