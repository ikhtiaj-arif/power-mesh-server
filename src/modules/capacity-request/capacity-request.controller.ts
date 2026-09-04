import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { CapacityRequestServices } from "./capacity-request.service";
import type { RequestUser } from "../../app/middleware/checkAuth";
import { AppError } from "../../utils/appError";

const createRequest = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const result = await CapacityRequestServices.createRequest(
    req.body,
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Capacity request created successfully",
    data: result,
  });
});

const getAllRequests = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const result = await CapacityRequestServices.getAllRequests(query as never);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Capacity requests fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getMyRequests = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const query = req.query;
  const result = await CapacityRequestServices.getMyRequests(
    query as never,
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your capacity requests fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getRequestsByEvent = catchAsync(async (req: Request, res: Response) => {
  const eventId = req.params.eventId as string;
  const query = req.query;
  const result = await CapacityRequestServices.getRequestsByEvent(
    { eventId },
    query as never,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Capacity requests for event fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getRequestById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await CapacityRequestServices.getRequestById({ id });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Capacity request fetched successfully",
    data: result,
  });
});

const updateRequest = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const id = req.params.id as string;
  const result = await CapacityRequestServices.updateRequest(
    { id },
    req.body,
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Capacity request updated successfully",
    data: result,
  });
});

const cancelRequest = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const id = req.params.id as string;
  const result = await CapacityRequestServices.cancelRequest(
    { id },
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Capacity request cancelled successfully",
    data: result,
  });
});

const softDeleteRequest = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const id = req.params.id as string;
  const result = await CapacityRequestServices.softDeleteRequest(
    { id },
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Capacity request deleted successfully",
    data: result,
  });
});

export const CapacityRequestController = {
  createRequest,
  getAllRequests,
  getMyRequests,
  getRequestsByEvent,
  getRequestById,
  updateRequest,
  cancelRequest,
  softDeleteRequest,
};
