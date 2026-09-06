import config from "../../app/config";
import { jwtUtils } from "../../utils/jwt";
import { AppError } from "../../utils/appError";
import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import crypto from "crypto";
import { prisma } from "../../app/lib/primsa";
import path from "path";
import {
  ProviderStatus,
  UserStatus,
  UserRole,
} from "../../../prisma/generated/prisma/enums";
import type {
  IApplyAsProviderPayload,
  IApproveProviderPayload,
  IGetAllProvidersQuery,
  IGetProviderByIdParams,
  IRejectProviderPayload,
  IVerifyProviderEmailPayload,
} from "./provider.interface";
import { redisClient } from "../../app/lib/redis";
import { transporter } from "../../app/lib/nodemailer";
import ejs from "ejs";
import type { SignOptions } from "jsonwebtoken";

const applyAsProvider = async (payload: IApplyAsProviderPayload) => {
  const { firstName, lastName, password, provider: providerData } = payload;
  const email = payload.email.trim().toLowerCase();

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    throw new AppError(
      httpStatus.CONFLICT,
      "User with this email already exists",
    );
  }

  const isLicenseExists = await prisma.provider.findUnique({
    where: { licenseNumber: providerData.licenseNumber },
  });

  if (isLicenseExists) {
    throw new AppError(
      httpStatus.CONFLICT,
      "A provider with this license number already exists",
    );
  }

  const hashedPassword = await bcrypt.hash(password, 8);

  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpKey = `provider-registration-otp:${email}`;

  await redisClient.set(otpKey, otp, {
    expiration: {
      type: "EX",
      value: 5 * 60,
    },
  });

  const registrationKey = `provider-registration-data:${email}`;
  const redisPayload = {
    firstName,
    lastName,
    email,
    password: hashedPassword,
    provider: providerData,
  };

  await redisClient.set(
    registrationKey,
    JSON.stringify(redisPayload),
    {
      expiration: {
        type: "EX",
        value: 5 * 60,
      },
    },
  );

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/registration-user-otp.ejs",
  );
  const expSec = 5 * 60;

  const html = await ejs.renderFile(templatePath, {
    name: firstName + " " + lastName,
    otp,
    expirationMinutes: expSec / 60,
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: email,
    subject: "PowerMesh - Provider Email Verification",
    html,
  });
};

const verifyProviderEmail = async (payload: IVerifyProviderEmailPayload) => {
  const email = payload.email.trim().toLowerCase();

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists?.status === UserStatus.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }
  if (isUserExists?.emailVerified) {
    throw new AppError(httpStatus.CONFLICT, "Email already verified");
  }
  if (isUserExists?.status === UserStatus.DELETED || isUserExists?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User is deleted");
  }

  const otpKey = `provider-registration-otp:${email}`;
  const redisOTP = await redisClient.get(otpKey);

  if (!redisOTP) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP expired or invalid");
  }
  if (redisOTP !== payload.otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
  }
  await redisClient.del(otpKey);

  const registrationKey = `provider-registration-data:${email}`;
  const redisData = await redisClient.get(registrationKey);
  if (!redisData) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Registration data not found. Please apply again.",
    );
  }

  const providerPayload: IApplyAsProviderPayload = JSON.parse(redisData);

  const createdUser = await prisma.user.create({
    data: {
      firstName: providerPayload.firstName,
      lastName: providerPayload.lastName,
      email: providerPayload.email,
      password: providerPayload.password,
      role: UserRole.PROVIDER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      provider: {
        create: {
          companyName: providerPayload.provider.companyName,
          licenseNumber: providerPayload.provider.licenseNumber,
          resourceType: providerPayload.provider.resourceType,
          capacityKw: providerPayload.provider.capacityKw,
          address: providerPayload.provider.address,
          contactPerson: providerPayload.provider.contactPerson,
          contactPhone: providerPayload.provider.contactPhone,
          bankAccountNumber: providerPayload.provider.bankAccountNumber || null,
          status: ProviderStatus.PENDING_APPROVAL,
        },
      },
    },
    omit: { password: true },
    include: { provider: true },
  });

  await redisClient.del(registrationKey);

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/provider-welcome-email.ejs",
  );

  const html = await ejs.renderFile(templatePath, {
    name: createdUser.firstName + " " + createdUser.lastName,
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: email,
    subject: "Welcome to PowerMesh - Provider Application Received",
    html,
  });

  const { provider, ...user } = createdUser;
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
    user,
    provider,
    accessToken,
    refreshToken,
  };
};

const approveProvider = async (payload: IApproveProviderPayload, adminId: string) => {
  const provider = await prisma.provider.findUnique({
    where: { id: payload.providerId },
    include: { user: true },
  });

  if (!provider) {
    throw new AppError(httpStatus.NOT_FOUND, "Provider not found");
  }

  if (provider.status === ProviderStatus.APPROVED) {
    throw new AppError(httpStatus.CONFLICT, "Provider is already approved");
  }

  if (provider.status === ProviderStatus.REJECTED) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Provider has been rejected. They need to re-apply.",
    );
  }

  const updatedProvider = await prisma.provider.update({
    where: { id: payload.providerId },
    data: {
      status: ProviderStatus.APPROVED,
      verified: true,
      verifiedAt: new Date(),
      verifiedBy: adminId,
    },
    include: { user: { omit: { password: true } } },
  });

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/provider-welcome-email.ejs",
  );

  const html = await ejs.renderFile(templatePath, {
    name: updatedProvider.user.firstName + " " + updatedProvider.user.lastName,
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: updatedProvider.user.email,
    subject: "PowerMesh - Provider Application Approved",
    html,
  });

  return updatedProvider;
};

const rejectProvider = async (payload: IRejectProviderPayload) => {
  const provider = await prisma.provider.findUnique({
    where: { id: payload.providerId },
    include: { user: true },
  });

  if (!provider) {
    throw new AppError(httpStatus.NOT_FOUND, "Provider not found");
  }

  if (provider.status === ProviderStatus.REJECTED) {
    throw new AppError(httpStatus.CONFLICT, "Provider is already rejected");
  }

  const updatedProvider = await prisma.provider.update({
    where: { id: payload.providerId },
    data: {
      status: ProviderStatus.REJECTED,
      rejectionReason: payload.rejectionReason,
    },
    include: { user: { omit: { password: true } } },
  });

  return updatedProvider;
};

const getAllProviders = async (query: IGetAllProvidersQuery) => {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (status) {
    where.status = status;
  }

  const [providers, total] = await Promise.all([
    prisma.provider.findMany({
      where,
      include: {
        user: {
          omit: { password: true },
        },
      },
      // skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.provider.count({ where }),
  ]);

  return {
    providers,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getProviderById = async (params: IGetProviderByIdParams) => {
  const provider = await prisma.provider.findUnique({
    where: { id: params.id },
    include: {
      user: {
        omit: { password: true },
      },
    },
  });

  if (!provider) {
    throw new AppError(httpStatus.NOT_FOUND, "Provider not found");
  }

  return provider;
};

export const ProviderServices = {
  applyAsProvider,
  verifyProviderEmail,
  approveProvider,
  rejectProvider,
  getAllProviders,
  getProviderById,
};
