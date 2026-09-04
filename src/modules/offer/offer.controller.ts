import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { OfferServices } from "./offer.service";
import type { RequestUser } from "../../app/middleware/checkAuth";
import { AppError } from "../../utils/appError";

const createOffer = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const result = await OfferServices.createOffer(req.body, user.userId);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Capacity offer created successfully",
    data: result,
  });
});

const getAllOffers = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const result = await OfferServices.getAllOffers(query as never);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Offers fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getMyOffers = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const query = req.query;
  const result = await OfferServices.getMyOffers(
    query as never,
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your offers fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getOfferById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await OfferServices.getOfferById({ id });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Offer fetched successfully",
    data: result,
  });
});

const updateOffer = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const id = req.params.id as string;
  const result = await OfferServices.updateOffer(
    { id },
    req.body,
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Offer updated successfully",
    data: result,
  });
});

const softDeleteOffer = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const id = req.params.id as string;
  const result = await OfferServices.softDeleteOffer(
    { id },
    user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Offer deleted successfully",
    data: result,
  });
});

const getOffersByEvent = catchAsync(async (req: Request, res: Response) => {
  const eventId = req.params.eventId as string;
  const query = req.query;
  const result = await OfferServices.getOffersByEvent(
    { eventId },
    query as never,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Offers for event fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

export const OfferController = {
  createOffer,
  getAllOffers,
  getMyOffers,
  getOfferById,
  updateOffer,
  softDeleteOffer,
  getOffersByEvent,
};
