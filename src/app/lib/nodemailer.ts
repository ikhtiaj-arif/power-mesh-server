import dns from "node:dns";
import nodemailer, { type Transporter } from "nodemailer";
import config from "../config";

const COMMON = {
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 20_000,
  auth: {
    user: config.smtp_user,
    pass: config.smtp_password,
  },
};

// Resolve the SMTP host to a single IPv4 address. Render has no IPv6 egress,
// and nodemailer skips its own IPv4+IPv6 DNS resolution when `host` is a
// literal IP (avoids the noisy IPv6 `ENETUNREACH` fallback attempts).
let cachedIpv4 = "";
const lookupIpv4 = async (): Promise<string> => {
  if (cachedIpv4) return cachedIpv4;
  try {
    const { address } = await dns.promises.lookup(config.smtp_host, { family: 4 });
    cachedIpv4 = address;
    return address;
  } catch {
    return config.smtp_host;
  }
};

const makeTransport = (port: number, secure: boolean): Transporter =>
  nodemailer.createTransport({
    host: cachedIpv4 || config.smtp_host,
    port,
    secure,
    tls: { servername: config.smtp_host },
    ...COMMON,
  });

await lookupIpv4();
console.log(`SMTP resolved ${config.smtp_host} -> ${cachedIpv4 || "(fallback to hostname)"}`);

// Gmail SMTP: 465 = implicit TLS, 587 = STARTTLS. Some egress networks
// (like Render) block one port but allow the other, so we try both.
export const transporter = makeTransport(config.smtp_port, config.smtp_port === 465);
const fallbackTransporter = makeTransport(587, false);

type SendMailParams = Parameters<typeof transporter.sendMail>[0];

export interface SendEmailResult {
  sent: boolean;
  reason?: string;
}

/**
 * Sends an email without ever crashing the request. Tries the primary SMTP
 * port first, then a 587/STARTTLS fallback. When SMTP is unreachable the
 * failure is logged as a warning and the caller decides how to fail open
 * (e.g. return the OTP to the client for demo purposes).
 */
export const sendEmail = async (options: SendMailParams): Promise<SendEmailResult> => {
  const attempts = [transporter, fallbackTransporter];
  let lastReason = "";

  for (const attempt of attempts) {
    try {
      await attempt.sendMail(options);
      return { sent: true };
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
    }
  }

  console.warn(`Warning: email not sent (SMTP unavailable): ${lastReason}`);
  return { sent: false, reason: lastReason };
};
