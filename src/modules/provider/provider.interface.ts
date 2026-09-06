import type { ResourceType } from "../../../prisma/generated/prisma/enums";

export interface IApplyAsProviderPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  provider: {
    companyName: string;
    licenseNumber: string;
    resourceType: ResourceType;
    capacityKw: number;
    address: string;
    contactPerson: string;
    contactPhone: string;
    bankAccountNumber?: string;
  };
}

export interface IVerifyProviderEmailPayload {
  email: string;
  otp: string;
}

export interface IApproveProviderPayload {
  providerId: string;
}

export interface IRejectProviderPayload {
  providerId: string;
  rejectionReason: string;
}

export interface IGetAllProvidersQuery {
  page: number;
  limit: number;
  status?: string;
}

export interface IGetProviderByIdParams {
  id: string;
}
