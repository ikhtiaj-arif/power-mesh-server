import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type Request,
	type Response,
} from "express";
 
import crypto from "crypto";
import config from "./app/config";
import httpStatus from "http-status";
import { AuthRoutes } from "./modules/auth/auth.routes";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
 

const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());
 
app.use("/api/v1/auth", AuthRoutes);


app.get("/test", async (req: Request, res: Response) => {
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
app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to power-mesh Backend",
	});
});
app.use(globalErrorHandler);
app.use(notFound);


export default app;
