import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { JwtPayload } from "jsonwebtoken";
import type { UserRole } from "../../../prisma/generated/prisma/browser";
import { AppError } from "../../utils/appError";

import { catchAsync } from "../../utils/catchAsync";
import { jwtUtils } from "../../utils/jwt";
import config from "../config";
import { prisma } from "../lib/primsa";

export interface RequestUser {
  email: string;
  name: string;
  userId: string;
  role: UserRole;
}
declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

// auth(UserRole.ADMIN, UserRole.CONSUMER, UserRole.PROVIDER, UserRole.OPERATOR)
// auth() => ...requiredRoles => [UserRole.ADMIN, UserRole.CONSUMER, UserRole.PROVIDER, UserRole.OPERATOR]
export const auth = (...requiredRoles: UserRole[]) => {
  return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies.accessToken
      ? req.cookies.accessToken
      : req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization?.split(" ")[1]
        : req.headers.authorization;

    if (!token) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "You are not logged in. Please log in to access this resource.",
      );
    }

    // Next.js ISR / build-time catalog fetches use a shared service token so
    // pages can stay static (no per-request user cookies in the RSC tree).
    // The synthetic user is an ADMIN; staff list endpoints allow ADMIN.
    if (config.isr_service_token && token === config.isr_service_token) {
      const admin = await prisma.user.findFirst({
        where: {
          role: "ADMIN",
          status: { not: "BLOCKED" },
          deletedAt: null,
        },
        orderBy: { createdAt: "asc" },
      });

      if (!admin) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "No admin user available for ISR service authentication.",
        );
      }

      if (requiredRoles.length && !requiredRoles.includes(admin.role)) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Forbidden. ISR service token cannot access this resource.",
        );
      }

      req.user = {
        email: admin.email,
        name: `${admin.firstName} ${admin.lastName}`.trim(),
        userId: admin.id,
        role: admin.role,
      };

      next();
      return;
    }

    const verifiedToken = jwtUtils.verifyToken(token, config.jwt_access_secret);

    if (!verifiedToken.success) {
      throw new AppError(httpStatus.UNAUTHORIZED, verifiedToken.error);
    }

    const { email, name, userId, role } = verifiedToken.data as JwtPayload;

    if (requiredRoles.length && !requiredRoles.includes(role)) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Forbidden. You don't have permission to access this resource.",
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found. Please log in again.");
    }

    if (user.status === "BLOCKED") {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Your account has been blocked. Please contact support.",
      );
    }

    req.user = {
      email,
      name,
      userId,
      role,
    };

    next();
  });
};
