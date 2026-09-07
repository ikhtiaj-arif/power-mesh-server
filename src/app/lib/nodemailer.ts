import nodemailer from "nodemailer";
import config from "../config";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: config.smtp_user,
    pass: config.smtp_password,
  },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

type SendMailParams = Parameters<typeof transporter.sendMail>[0];

export interface SendEmailResult {
  sent: boolean;
  reason?: string;
}

/**
 * Sends an email without ever crashing the request. When SMTP is
 * unavailable (e.g. Gmail unreachable from Render), the failure is logged
 * as a warning and the caller decides how to fail open (e.g. return the
 * OTP to the client for demo purposes).
 */
export const sendEmail = async (options: SendMailParams): Promise<SendEmailResult> => {
  try {
    await transporter.sendMail(options);
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Warning: email not sent (SMTP unavailable):", message);
    return { sent: false, reason: message };
  }
};
