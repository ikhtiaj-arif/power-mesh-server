import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { RequestUser } from "../../app/middleware/checkAuth";
import { AppError } from "../../utils/appError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { detectImageType } from "../../app/lib/multer";
import { UserServices } from "./user.service";

const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing in the request");
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
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing in the request");
  }

  const result = await UserServices.updateMe(req.body, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile updated successfully",
    data: result,
  });
});

const uploadProfilePicture = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing in the request");
  }

  if (!req.file) {
    throw new AppError(httpStatus.BAD_REQUEST, "No image file provided");
  }

  if (!detectImageType(req.file.buffer)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only JPEG, PNG, WEBP and AVIF images are allowed.",
    );
  }

  const result = await UserServices.uploadProfilePicture(req.file, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile picture uploaded successfully",
    data: result,
  });
});

export const UserController = {
  getMe,
  updateMe,
  uploadProfilePicture,
};
