import type { SignOptions } from "jsonwebtoken";
import config from "../../app/config";
import { jwtUtils } from "../../utils/jwt";
import { AppError } from "../../utils/appError";
import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import crypto from "crypto";
import { prisma } from "../../app/lib/primsa";
import path from "path";
import { UserRole, UserStatus } from "../../../prisma/generated/prisma/enums";
import type { ILoginUserPayload, IRegisterConsumerPayload } from "./auth.interface";

const registerConsumer = async (payload: IRegisterConsumerPayload) => {
	const { firstName, lastName, password, consumer: consumerData } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new AppError(httpStatus.CONFLICT, "User with this email already exists");
	}
	const hashedPassword = await bcrypt.hash(password, 8);
    
    const createdUser = await prisma.user.create({
		data: {
			firstName: firstName,
			lastName: lastName,
			email: email,
			password: hashedPassword,
			role: UserRole.CONSUMER,
			status: UserStatus.ACTIVE,
			emailVerified: true,
		
		},
		omit: { password: true },
		include: { consumer: true },
	});

    return createdUser;
	
};

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.NOT_FOUND, "User is deleted");
	}

	if (user.password === null && user.googleId !== null) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User Already Has Account Registered With Google. Try To Login With Google.",
		);
	}

	const isPasswordMatched = await bcrypt.compare(
		password,
		user.password as string,
	);

	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.firstName + " " + user.lastName,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};


export const AuthServices = {
    registerConsumer,
    loginUser,
};