import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { ProviderServices } from "./provider.service";
import type { RequestUser } from "../../app/middleware/checkAuth";
import { AppError } from "../../utils/appError";

const applyAsProvider = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  await ProviderServices.applyAsProvider(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Verification OTP sent to your email",
    data: null,
  });
});

const verifyProviderEmail = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const result = await ProviderServices.verifyProviderEmail(payload);
  const { accessToken, refreshToken, user, provider } = result;

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: false,
    sameSite: "none",
    maxAge: 1000 * 60 * 60 * 24,
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: "none",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Email verified successfully! Your application is pending approval.",
    data: {
      accessToken,
      refreshToken,
      user,
      provider,
    },
  });
});

const approveProvider = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const payload = req.body;
  const result = await ProviderServices.approveProvider(payload, user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Provider approved successfully",
    data: result,
  });
});

const rejectProvider = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const result = await ProviderServices.rejectProvider(payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Provider rejected",
    data: result,
  });
});

const getAllProviders = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const result = await ProviderServices.getAllProviders(query as never);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Providers fetched successfully",
    data: result.providers,
    meta: result.meta,
  });
});

const getProviderById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await ProviderServices.getProviderById({ id });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Provider fetched successfully",
    data: result,
  });
});

export const ProviderController = {
  applyAsProvider,
  verifyProviderEmail,
  approveProvider,
  rejectProvider,
  getAllProviders,
  getProviderById,
};
