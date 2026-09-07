import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AdminRoutes } from "./modules/admin/admin.routes";
import { AuthRoutes } from "./modules/auth/auth.routes";
import { CapacityRequestRoutes } from "./modules/capacity-request/capacity-request.routes";
import { DeliveryRoutes } from "./modules/delivery/delivery.routes";
import { EventRoutes } from "./modules/event/event.routes";
import { OfferRoutes } from "./modules/offer/offer.routes";
import { PaymentRoutes } from "./modules/payment/payment.routes";
import { ProviderRoutes } from "./modules/provider/provider.routes";
import { ReservationRoutes } from "./modules/reservation/reservation.routes";
import { UserRoutes } from "./modules/user/user.routes";

const app: Application = express();

app.use(
  cors({
    origin: config.frontend_url,
    credentials: true,
  }),
);

// Security headers
app.use(helmet());

// Global rate limiter: 200 requests per 15 minutes per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests, please try again later",
      errors: ["Rate limit exceeded"],
    },
  }),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

// Stricter rate limiter for auth/payment routes: 30 requests per 15 minutes
const authPaymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication/payment attempts, please try again later",
    errors: ["Rate limit exceeded for this endpoint"],
  },
});

// Health check: keep-alive ping target, also useful for uptime monitoring
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/v1/auth", authPaymentLimiter, AuthRoutes);
app.use("/api/v1/provider", authPaymentLimiter, ProviderRoutes);
app.use("/api/v1/offer", OfferRoutes);
app.use("/api/v1/event", EventRoutes);
app.use("/api/v1/request", CapacityRequestRoutes);
app.use("/api/v1/reservation", ReservationRoutes);
app.use("/api/v1/payments", authPaymentLimiter, PaymentRoutes);
app.use("/api/v1/admin", AdminRoutes);
app.use("/api/v1/users", UserRoutes);
app.use("/api/v1/delivery", DeliveryRoutes);

app.get("/test", async (_req: Request, res: Response) => {
  try {
    res.status(httpStatus.OK).json({
      success: true,
      message: "Welcome to power-mesh-server Backend",
      data: null,
    });
  } catch (error) {
    console.log(error);
    res.status(httpStatus.BAD_REQUEST).json({
      success: true,
      message: "Error to power-mesh-server Backend",
      data: error,
    });
  }
});

// Basic route
app.get("/", async (_req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: "Welcome to power-mesh Backend",
  });
});
app.use(globalErrorHandler);
app.use(notFound);

export default app;
