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
import type {
  ILoginUserPayload,
  IRegisterConsumerPayload,
  IVerifyConsumerPayload,
} from "./auth.interface";
import { redisClient } from "../../app/lib/redis";
import { transporter } from "../../app/lib/nodemailer";
import ejs from "ejs";

const registerConsumer = async (payload: IRegisterConsumerPayload) => {
  const { firstName, lastName, password, consumer: consumerData } = payload;
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
  const hashedPassword = await bcrypt.hash(password, 8);

  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpKey = `consumer-registration-otp:${email}`;

  await redisClient.set(otpKey, otp, {
    expiration: {
      type: "EX",
      value: 5 * 60,
    },
  });

  const consumerRegistrationKey = `consumer-registration-data:${email}`;
  const redisUserDataPayload = {
    firstName,
    lastName,
    email,
    password: hashedPassword,
    consumer: consumerData,
  };
//   console.log(redisUserDataPayload);
  await redisClient.set(
    consumerRegistrationKey,
    JSON.stringify(redisUserDataPayload),
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
    subject: "Email Verification",
    // text: `Your OTP Is: ${otp}`,
    html,
  });
};

const verifyConsumerEmail = async (payload: IVerifyConsumerPayload) => {
  const email = payload.email.trim().toLowerCase();

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists?.status === UserStatus.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "User is Blocked!");
  }
  if (isUserExists?.emailVerified) {
    throw new AppError(httpStatus.CONFLICT, "Email Already Verified!");
  }
  if (isUserExists?.status === UserStatus.DELETED || isUserExists?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User is Deleted!");
  }
  const otp = payload.otp;
  const otpKey = `consumer-registration-otp:${email}`;
  const redisOTP = await redisClient.get(otpKey);

  if (!redisOTP) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
  }
  if (redisOTP !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
  }
  await redisClient.del(otpKey);

  const consumerRegistrationKey = `consumer-registration-data:${email}`;
  const redisConsumerData = await redisClient.get(consumerRegistrationKey);
  if (!redisConsumerData) {
    throw new AppError(httpStatus.NOT_FOUND, "User does not exists");
  }

  const consumerPayload: IRegisterConsumerPayload =
    JSON.parse(redisConsumerData);

  const createdUser = await prisma.user.create({
    data: {
      firstName: consumerPayload.firstName,
      lastName: consumerPayload.lastName,
      email: consumerPayload.email,
      password: consumerPayload.password,
      role: UserRole.CONSUMER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      consumer: {
        create: {
          organizationName: consumerPayload?.consumer.organizationName || "",
          criticalLoadKw: consumerPayload?.consumer.criticalLoadKw || 0,
          address: consumerPayload?.consumer.address || "",
          contactPerson: consumerPayload?.consumer.contactPerson || "" ,
          contactPhone: consumerPayload?.consumer?.contactPhone || "",
        },
      },
    },
    omit: { password: true },
    include: { consumer: true },
  });

  await redisClient.del(consumerRegistrationKey);
  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/consumer-welcome-email.ejs",
  );
  const expSec = 5 * 60;

  const html = await ejs.renderFile(templatePath, {
    name: createdUser.firstName + " " + createdUser.lastName,
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: email,
    subject: "Welcome to PowerMesh System",
    // text: `Your OTP Is: ${otp}`,
    html,
  });

  const { consumer, ...user } = createdUser;
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
    consumer,
    accessToken,
    refreshToken,
  };
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
  verifyConsumerEmail,
};
