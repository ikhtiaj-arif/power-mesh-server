import httpStatus from "http-status";
import { prisma } from "../../app/lib/primsa";
import { AppError } from "../../utils/appError";
import { Prisma } from "../../../prisma/generated/prisma/client";
import type { RequestUser } from "../../app/middleware/checkAuth";
import type { IUpdateMePayload } from "./user.interface";

const getMe = async (user: RequestUser) => {
  const profile = await prisma.user.findUnique({
    where: { id: user.userId, deletedAt: null },
    omit: { password: true },
    include: {
      consumer: true,
      provider: true,
      operator: true,
    },
  });

  if (!profile) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return profile;
};

const updateMe = async (payload: IUpdateMePayload, user: RequestUser) => {
  const existing = await prisma.user.findUnique({
    where: { id: user.userId, deletedAt: null },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const userData: Prisma.UserUpdateInput = {};

  if (payload.firstName !== undefined) {
    userData.firstName = payload.firstName;
  }
  if (payload.lastName !== undefined) {
    userData.lastName = payload.lastName;
  }
  if (payload.imageUrl !== undefined) {
    userData.imageUrl = payload.imageUrl;
  }

  const consumerData: Prisma.ConsumerUncheckedUpdateInput = {};
  if (payload.consumer) {
    if (payload.consumer.organizationName !== undefined) {
      consumerData.organizationName = payload.consumer.organizationName;
    }
    if (payload.consumer.criticalLoadKw !== undefined) {
      consumerData.criticalLoadKw = payload.consumer.criticalLoadKw;
    }
    if (payload.consumer.address !== undefined) {
      consumerData.address = payload.consumer.address;
    }
    if (payload.consumer.contactPerson !== undefined) {
      consumerData.contactPerson = payload.consumer.contactPerson;
    }
    if (payload.consumer.contactPhone !== undefined) {
      consumerData.contactPhone = payload.consumer.contactPhone;
    }
  }
  const hasConsumerData = Object.keys(consumerData).length > 0;

  const providerData: Prisma.ProviderUncheckedUpdateInput = {};
  if (payload.provider) {
    if (payload.provider.companyName !== undefined) {
      providerData.companyName = payload.provider.companyName;
    }
    if (payload.provider.address !== undefined) {
      providerData.address = payload.provider.address;
    }
    if (payload.provider.contactPerson !== undefined) {
      providerData.contactPerson = payload.provider.contactPerson;
    }
    if (payload.provider.contactPhone !== undefined) {
      providerData.contactPhone = payload.provider.contactPhone;
    }
    if (payload.provider.bankAccountNumber !== undefined) {
      providerData.bankAccountNumber = payload.provider.bankAccountNumber;
    }
  }
  const hasProviderData = Object.keys(providerData).length > 0;

  const data: Prisma.UserUpdateInput = {
    ...userData,
  };

  if (hasConsumerData) {
    data.consumer = {
      update: consumerData,
    };
  }
  if (hasProviderData) {
    data.provider = {
      update: providerData,
    };
  }

  const updated = await prisma.user.update({
    where: { id: user.userId },
    data,
    omit: { password: true },
    include: {
      consumer: true,
      provider: true,
      operator: true,
    },
  });

  return updated;
};

export const UserServices = {
  getMe,
  updateMe,
};