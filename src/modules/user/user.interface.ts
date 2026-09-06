export interface IUpdateUserData {
  organizationName?: string;
  criticalLoadKw?: number;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
}

export interface IUpdateProviderData {
  companyName?: string;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  bankAccountNumber?: string;
}

export interface IUpdateMePayload {
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  consumer?: IUpdateUserData;
  provider?: IUpdateProviderData;
}