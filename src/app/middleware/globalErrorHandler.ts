import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import multer from "multer";
import { Prisma } from "../../../prisma/generated/prisma/client";
import { AppError } from "../../utils/appError";
import config from "../config";

export const globalErrorHandler = async (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (config.node_env === "development") {
    console.log("Error from Global Error Handler", err);
  }

  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let message = "Internal Server Error";
  const errors: string[] = [];

  if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Validation error";
    errors.push("Incorrect field type or missing required fields");
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      statusCode = httpStatus.CONFLICT;
      message = "A record with this value already exists";
      errors.push("Duplicate key constraint violated");
    } else if (err.code === "P2003") {
      statusCode = httpStatus.BAD_REQUEST;
      message = "Related record not found";
      errors.push("Foreign key constraint failed");
    } else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      message = "Record not found";
      errors.push(
        "An operation failed because it depends on one or more records that were required but not found.",
      );
    }
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    if (err.errorCode === "P1000") {
      statusCode = httpStatus.UNAUTHORIZED;
      message = "Database authentication failed";
    } else if (err.errorCode === "P1001") {
      statusCode = httpStatus.BAD_REQUEST;
      message = "Cannot reach database server";
    }
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = "Error occurred during query execution";
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof multer.MulterError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "File upload error";
    errors.push(err.message);
  } else if (err instanceof Error) {
    message = err.message || "Internal Server Error";
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: errors.length > 0 ? errors : [message],
  });
};
