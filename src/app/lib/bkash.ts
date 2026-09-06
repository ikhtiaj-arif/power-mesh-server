import axios, { type AxiosInstance } from "axios";
import config from "../config";
import { redisClient } from "./redis";

const ID_TOKEN_KEY = "bkash:id_token";
const REFRESH_TOKEN_KEY = "bkash:refresh_token";

const ID_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 28;
const REFRESH_BEFORE_SECONDS = 10 * 60;

const createClient = (): AxiosInstance => {
  return axios.create({
    baseURL: config.bkash_base_url,
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
    },
  });
};

const grantToken = async () => {
  const client = createClient();
  const response = await client.post(
    "/tokenized/checkout/token/grant",
    {
      app_key: config.bkash_app_key,
      app_secret: config.bkash_app_secret,
    },
    {
      headers: {
        username: config.bkash_username,
        password: config.bkash_password,
      },
    },
  );

  const data = response.data as {
    id_token?: string;
    refresh_token?: string;
  };

  if (!data.id_token || !data.refresh_token) {
    throw new Error("bKash token grant failed");
  }

  await redisClient.set(ID_TOKEN_KEY, data.id_token, {
    expiration: {
      type: "EX",
      value: ID_TOKEN_TTL_SECONDS,
    },
  });

  await redisClient.set(REFRESH_TOKEN_KEY, data.refresh_token, {
    expiration: {
      type: "EX",
      value: REFRESH_TOKEN_TTL_SECONDS,
    },
  });

  return data;
};

const refreshToken = async (refreshToken: string) => {
  const client = createClient();
  const response = await client.post(
    "/tokenized/checkout/token/refresh",
    {
      app_key: config.bkash_app_key,
      app_secret: config.bkash_app_secret,
      refresh_token: refreshToken,
    },
    {
      headers: {
        username: config.bkash_username,
        password: config.bkash_password,
      },
    },
  );

  const data = response.data as {
    id_token?: string;
  };

  if (!data.id_token) {
    throw new Error("bKash token refresh failed");
  }

  await redisClient.set(ID_TOKEN_KEY, data.id_token, {
    expiration: {
      type: "EX",
      value: ID_TOKEN_TTL_SECONDS,
    },
  });

  return data;
};

export const getAccessToken = async (): Promise<string> => {
  const idToken = await redisClient.get(ID_TOKEN_KEY);
  const idTokenTTL = await redisClient.ttl(ID_TOKEN_KEY);

  const redisRefreshToken = await redisClient.get(REFRESH_TOKEN_KEY);
  const refreshTokenTTL = await redisClient.ttl(REFRESH_TOKEN_KEY);

  if (
    (idTokenTTL <= REFRESH_BEFORE_SECONDS || !idToken) &&
    redisRefreshToken &&
    refreshTokenTTL > REFRESH_BEFORE_SECONDS
  ) {
    const refreshed = await refreshToken(redisRefreshToken);
    return refreshed.id_token!;
  }

  if (idTokenTTL > REFRESH_BEFORE_SECONDS) {
    return idToken!;
  }

  const token = await grantToken();
  return token.id_token!;
};

interface ICreatePaymentInput {
  amount: string | number;
  merchantInvoiceNumber: string;
  payerReference: string;
  callbackUrl: string;
}

interface ICreatePaymentResponse {
  paymentID: string;
  bkashURL: string;
}

const createPayment = async (
  input: ICreatePaymentInput,
): Promise<ICreatePaymentResponse> => {
  const accessToken = await getAccessToken();
  const client = createClient();
  client.defaults.headers.Authorization = accessToken;
  client.defaults.headers["X-APP-Key"] = config.bkash_app_key;

  const response = await client.post("/tokenized/checkout/create", {
    mode: "0011",
    payerReference: input.payerReference,
    callbackURL: input.callbackUrl,
    amount: input.amount,
    currency: "BDT",
    intent: "sale",
    merchantInvoiceNumber: input.merchantInvoiceNumber,
  });

  const data = response.data as ICreatePaymentResponse;

  if (!data.paymentID || !data.bkashURL) {
    throw new Error("bKash create payment failed");
  }

  return data;
};

interface IExecutePaymentResponse {
  paymentID: string;
  trxID?: string;
  transactionStatus: string;
  amount?: string;
  paymentExecuteTime?: string;
  customerMsisdn?: string;
  transactionType?: string;
  merchantInvoiceNumber?: string;
}

const executePayment = async (
  paymentID: string,
): Promise<IExecutePaymentResponse> => {
  const accessToken = await getAccessToken();
  const client = createClient();
  client.defaults.headers.Authorization = accessToken;
  client.defaults.headers["X-APP-Key"] = config.bkash_app_key;

  const response = await client.post("/tokenized/checkout/execute", {
    paymentID,
  });

  return response.data as IExecutePaymentResponse;
};

const queryPayment = async (paymentID: string) => {
  const accessToken = await getAccessToken();
  const client = createClient();
  client.defaults.headers.Authorization = accessToken;
  client.defaults.headers["X-APP-Key"] = config.bkash_app_key;

  const response = await client.post("/tokenized/checkout/payment/status", {
    paymentID,
  });

  return response.data;
};

interface IRefundPaymentInput {
  paymentID: string;
  trxID: string;
  amount: string | number;
  sku?: string;
  reason: string;
}

const refundPayment = async (input: IRefundPaymentInput) => {
  const accessToken = await getAccessToken();
  const client = createClient();
  client.defaults.headers.Authorization = accessToken;
  client.defaults.headers["X-APP-Key"] = config.bkash_app_key;

  const response = await client.post("/tokenized/checkout/payment/refund", {
    paymentID: input.paymentID,
    trxID: input.trxID,
    amount: input.amount,
    sku: input.sku ?? "PowerMesh refund",
    reason: input.reason,
  });

  return response.data as {
    refundTrxID?: string;
    refundStatus?: string;
    completedTime?: string;
    amount?: string;
  };
};

export const bkash = {
  getAccessToken,
  grantToken,
  refreshToken,
  createPayment,
  executePayment,
  queryPayment,
  refundPayment,
};