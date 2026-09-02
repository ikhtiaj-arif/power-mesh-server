import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
 
import { catchAsync } from "../../utils/catchAsync";
import { jwtUtils } from "../../utils/jwt";
import { AppError } from "../../utils/appError";
import httpStatus from "http-status";
import type { UserRole } from "../../../prisma/generated/prisma/browser";
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
	return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
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
			throw new AppError(httpStatus.FORBIDDEN, "Your account has been blocked. Please contact support.");
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
