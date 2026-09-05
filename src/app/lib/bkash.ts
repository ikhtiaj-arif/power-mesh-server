import axios, { type AxiosInstance } from "axios";
import config from "../config";
import { redisClient } from "./redis";

const BKASH_TOKEN_KEY = "bkash:id_token";
const BKASH_TOKEN_EXPIRY_SECONDS = 3000;

let cachedToken: string | null = null;

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
  const response = await client.post("/tokenized/checkout/token/grant", {
    app_key: config.bkash_app_key,
    app_secret: config.bkash_app_secret,
    username: config.bkash_username,
    password: config.bkash_password,
  });

  const data = response.data as {
    id_token?: string;
    refresh_token?: string;
  };

  if (!data.id_token) {
    throw new Error("bKash token grant failed");
  }

  cachedToken = data.id_token;
  try {
    await redisClient.set(
      BKASH_TOKEN_KEY,
      data.id_token,
      {
        EX: BKASH_TOKEN_EXPIRY_SECONDS,
      },
    );
  } catch (error) {
    // Redis may not be available; fall back to in-memory cache.
    void error;
  }

  return data;
};

const refreshToken = async (refreshToken: string) => {
  const client = createClient();
  const response = await client.post("/tokenized/checkout/token/refresh", {
    app_key: config.bkash_app_key,
    app_secret: config.bkash_app_secret,
    refresh_token: refreshToken,
  });

  const data = response.data as {
    id_token?: string;
  };

  if (!data.id_token) {
    throw new Error("bKash token refresh failed");
  }

  cachedToken = data.id_token;
  try {
    await redisClient.set(
      BKASH_TOKEN_KEY,
      data.id_token,
      {
        EX: BKASH_TOKEN_EXPIRY_SECONDS,
      },
    );
  } catch (error) {
    void error;
  }

  return data;
};

export const getAccessToken = async (): Promise<string> => {
  if (cachedToken) {
    return cachedToken;
  }

  try {
    const redisToken = await redisClient.get(BKASH_TOKEN_KEY);
    if (redisToken) {
      cachedToken = redisToken;
      return redisToken;
    }
  } catch (error) {
    void error;
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

export const bkash = {
  grantToken,
  refreshToken,
  getAccessToken,
  createPayment,
  executePayment,
  queryPayment,
};
