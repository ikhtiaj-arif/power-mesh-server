import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { AdminServices } from "./admin.service";
import type { RequestUser } from "../../app/middleware/checkAuth";
import { AppError } from "../../utils/appError";

const getOverview = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminServices.getOverview();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin overview fetched successfully",
    data: result,
  });
});

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const result = await AdminServices.getAllUsers(query as never);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await AdminServices.getUserById({ id });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User fetched successfully",
    data: result,
  });
});

const blockUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await AdminServices.blockUser({ id }, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.isActive ? "User unblocked successfully" : "User blocked successfully",
    data: result,
  });
});

const softDeleteUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await AdminServices.softDeleteUser({ id });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User soft-deleted successfully",
    data: result,
  });
});

const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const result = await AdminServices.getAuditLogs(query as never);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Audit logs fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminServices.getDashboardStats();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin dashboard stats fetched successfully",
    data: result,
  });
});

const runAllocation = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await AdminServices.runAllocation({ id });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Allocation plan computed successfully",
    data: result,
  });
});

const approveAllocation = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as RequestUser;

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
  }

  const id = req.params.id as string;
  const result = await AdminServices.approveAllocation({ id }, user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Allocation approved and reservations created successfully",
    data: result,
  });
});

const updateReservationStatus = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as unknown as RequestUser;

    if (!user) {
      throw new AppError(httpStatus.BAD_REQUEST, "User information is missing");
    }

    const id = req.params.id as string;
    const result = await AdminServices.updateReservationStatus(
      { id },
      req.body,
      user.userId,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Reservation status updated successfully",
      data: result,
    });
  },
);

export const AdminController = {
  getOverview,
  getAllUsers,
  getUserById,
  blockUser,
  softDeleteUser,
  getAuditLogs,
  getDashboardStats,
  runAllocation,
  approveAllocation,
  updateReservationStatus,
};
