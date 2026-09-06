import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

type VerifyTokenSuccess = {
  success: true;
  data: string | JwtPayload;
};

type VerifyTokenFailure = {
  success: false;
  error: string;
};

type VerifyTokenResult = VerifyTokenSuccess | VerifyTokenFailure;

const createToken = (payload: JwtPayload, secret: string, expiresIn: SignOptions) => {
  const token = jwt.sign(payload, secret, {
    expiresIn,
  } as SignOptions);

  return token;
};

const verifyToken = (token: string, secret: string): VerifyTokenResult => {
  try {
    const verifiedToken = jwt.verify(token, secret);
    return {
      success: true,
      data: verifiedToken,
    };
  } catch (error: unknown) {
    console.log("Token verification failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown verification error",
    };
  }
};

export const jwtUtils = {
  createToken,
  verifyToken,
};
