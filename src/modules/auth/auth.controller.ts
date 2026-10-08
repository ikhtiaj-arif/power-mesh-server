import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { RequestUser } from "../../app/middleware/checkAuth";
import { AppError } from "../../utils/appError";
import {
  authCookieOptions,
  clearAuthCookieOptions,
  useCrossSiteAuthCookies,
} from "../../utils/authCookies";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import config from "../../app/config";
import { AuthServices } from "./auth.service";

const ACCESS_TOKEN_MAX_AGE = 1000 * 60 * 60 * 24;
const REFRESH_TOKEN_MAX_AGE = 1000 * 60 * 60 * 24 * 7;

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  const options = authCookieOptions(ACCESS_TOKEN_MAX_AGE);
  // #region agent log
  const debugPayload = {
    sessionId: "a75d46",
    runId: "post-fix",
    hypothesisId: "H1",
    location: "auth.controller.ts:setAuthCookies",
    message: "auth cookie options at login",
    data: {
      nodeEnv: config.node_env ?? null,
      frontendUrl: config.frontend_url ?? null,
      crossSite: useCrossSiteAuthCookies(),
      sameSite: options.sameSite ?? null,
      secure: Boolean(options.secure),
      httpOnly: Boolean(options.httpOnly),
    },
    timestamp: Date.now(),
  };
  console.log("[debug-a75d46]", JSON.stringify(debugPayload));
  fetch("http://127.0.0.1:7698/ingest/d4a25cba-e448-4169-84a8-d32878310aea", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "a75d46",
    },
    body: JSON.stringify(debugPayload),
  }).catch(() => {});
  // #endregion
  // Deploy fingerprint for post-fix probes (no secrets).
  res.setHeader(
    "X-PowerMesh-Cookie-Mode",
    useCrossSiteAuthCookies() ? "none-secure" : "lax",
  );
  res.cookie("accessToken", accessToken, options);
  res.cookie("refreshToken", refreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE));
};

const registerConsumer = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const result = await AuthServices.registerConsumer(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: result.emailSent
      ? "Verification OTP sent to your email"
      : "Email delivery unavailable - use the OTP returned below to complete verification",
    data: result,
  });
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  console.log(req.body);
  const result = await AuthServices.loginUser(payload);
  const { accessToken, refreshToken } = result;

  setAuthCookies(res, accessToken, refreshToken);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged in successfully",
    data: {
      accessToken,
      refreshToken,
    },
  });
});

const verifyConsumerEmail = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const result = await AuthServices.verifyConsumerEmail(payload);

  const { accessToken, refreshToken, user, consumer } = result;

  setAuthCookies(res, accessToken, refreshToken);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Email verification successful!",

    data: {
      accessToken,
      refreshToken,
      user,
      consumer,
    },
  });
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const result = await AuthServices.googleLogin(payload);
  const { accessToken, refreshToken } = result;

  setAuthCookies(res, accessToken, refreshToken);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged in successfully",
    data: {
      accessToken,
      refreshToken,
    },
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const token = (req.cookies.refreshToken as string) || (req.body.refreshToken as string);

  if (!token) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Refresh token is required");
  }

  const result = await AuthServices.refreshToken(token);
  const { accessToken, refreshToken: newRefreshToken } = result;

  setAuthCookies(res, accessToken, newRefreshToken);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tokens refreshed successfully",
    data: result,
  });
});

const logout = catchAsync(async (_req: Request, res: Response) => {
  res.clearCookie("accessToken", clearAuthCookieOptions());
  res.clearCookie("refreshToken", clearAuthCookieOptions());

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out successfully",
    data: null,
  });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing in the request");
  }

  const result = await AuthServices.getMe(user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile fetched successfully",
    data: result,
  });
});

export const AuthController = {
  registerConsumer,
  loginUser,
  verifyConsumerEmail,
  googleLogin,
  refreshToken,
  logout,
  getMe,
};
