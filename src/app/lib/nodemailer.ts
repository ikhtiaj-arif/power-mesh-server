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

interface ResendPayload {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

const sendViaResend = async (options: SendMailParams): Promise<boolean> => {
  if (!config.resend_api_key) return false;

  const payload: ResendPayload = {
    from: options.from as string,
    to: options.to as string,
    subject: options.subject as string,
    ...(options.html ? { html: options.html as string } : {}),
    ...(options.text ? { text: options.text as string } : {}),
  };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resend_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`Warning: Resend API error ${response.status}: ${body}`);
      return false;
    }
    console.log("Email sent via Resend (HTTPS API).");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: Resend API unavailable: ${message}`);
    return false;
  }
};

interface BrevoNameEmail {
  name?: string;
  email: string;
}

const parseAddress = (value: unknown): BrevoNameEmail => {
  if (typeof value !== "string") return { email: String(value ?? "") };
  const match = /^\s*(.*?)\s*<\s*([^>]+)\s*>$/.exec(value);
  if (match) {
    const name = match[1]?.trim();
    const email = match[2]?.trim() ?? "";
    return name ? { name, email } : { email };
  }
  return { email: value.trim() };
};

const toRecipients = (value: unknown): BrevoNameEmail[] => {
  if (Array.isArray(value)) return value.map(parseAddress);
  return [parseAddress(value)];
};

const sendViaBrevo = async (options: SendMailParams): Promise<boolean> => {
  if (!config.brevo_api_key) return false;

  const sender = parseAddress(options.from);
  const payload = {
    sender,
    to: toRecipients(options.to),
    subject: options.subject as string,
    ...(options.html ? { htmlContent: options.html as string } : {}),
    ...(options.text ? { textContent: options.text as string } : {}),
  };

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": config.brevo_api_key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`Warning: Brevo API error ${response.status}: ${body}`);
      return false;
    }
    console.log("Email sent via Brevo (HTTPS API).");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: Brevo API unavailable: ${message}`);
    return false;
  }
};

/**
 * Sends an email without ever crashing the request. Tries the primary SMTP
 * port, a 587/STARTTLS fallback, then the Resend/Brevo HTTPS APIs (when
 * configured). When delivery is entirely unavailable the failure is logged as
 * a warning and the caller decides how to fail open (e.g. return the OTP).
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

  if (await sendViaResend(options)) {
    return { sent: true };
  }

  if (await sendViaBrevo(options)) {
    return { sent: true };
  }

  console.warn(`Warning: email not sent (SMTP unavailable): ${lastReason}`);
  return { sent: false, reason: lastReason };
};
