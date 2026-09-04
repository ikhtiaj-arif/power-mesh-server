import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { EventServices } from "./event.service";
import type { RequestUser } from "../../app/middleware/checkAuth";
import { AppError } from "../../utils/appError";

const createEvent = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const result = await EventServices.createEvent(req.body, user.userId);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Outage event created successfully",
    data: result,
  });
});

const getAllEvents = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const result = await EventServices.getAllEvents(query as never);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Events fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getMyEvents = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const query = req.query;
  const result = await EventServices.getMyEvents(query as never, user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your events fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getAvailableEvents = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const result = await EventServices.getAvailableEvents(query as never);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Available events fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getEventById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await EventServices.getEventById({ id });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event fetched successfully",
    data: result,
  });
});

const updateEvent = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const id = req.params.id as string;
  const result = await EventServices.updateEvent({ id }, req.body, user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event updated successfully",
    data: result,
  });
});

const updateEventStatus = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const id = req.params.id as string;
  const result = await EventServices.updateEventStatus(
    { id },
    req.body,
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event status updated successfully",
    data: result,
  });
});

const softDeleteEvent = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const id = req.params.id as string;
  const result = await EventServices.softDeleteEvent({ id }, user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event deleted successfully",
    data: result,
  });
});

export const EventController = {
  createEvent,
  getAllEvents,
  getMyEvents,
  getAvailableEvents,
  getEventById,
  updateEvent,
  updateEventStatus,
  softDeleteEvent,
};
