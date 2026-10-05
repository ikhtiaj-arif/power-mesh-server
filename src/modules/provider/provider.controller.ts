import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { RequestUser } from "../../app/middleware/checkAuth";
import { AppError } from "../../utils/appError";
import { authCookieOptions } from "../../utils/authCookies";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ProviderServices } from "./provider.service";
import { ProviderValidation } from "./provider.validation";

const ACCESS_TOKEN_MAX_AGE = 1000 * 60 * 60 * 24;
const REFRESH_TOKEN_MAX_AGE = 1000 * 60 * 60 * 24 * 7;

const applyAsProvider = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const result = await ProviderServices.applyAsProvider(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: result.emailSent
      ? "Verification OTP sent to your email"
      : "Email delivery unavailable - use the OTP returned below to complete verification",
    data: result,
  });
});

const verifyProviderEmail = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const result = await ProviderServices.verifyProviderEmail(payload);
  const { accessToken, refreshToken, user, provider } = result;

  res.cookie("accessToken", accessToken, authCookieOptions(ACCESS_TOKEN_MAX_AGE));
  res.cookie("refreshToken", refreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE));

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
  const parsed = ProviderValidation.GetAllProvidersZodSchema.safeParse(req.query);

  if (!parsed.success) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      parsed.error.issues[0]?.message ?? "Invalid query parameters",
    );
  }

  const result = await ProviderServices.getAllProviders(parsed.data);

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
