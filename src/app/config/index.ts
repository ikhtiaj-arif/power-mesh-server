import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

/**
 * Reads an environment variable and fails fast at boot if it is missing.
 * Prefer this over bare non-null assertions so config errors surface early.
 */
const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export default {
  node_env: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  frontend_url: process.env.FRONTEND_URL,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS || "10",

  jwt_access_secret: required("JWT_ACCESS_SECRET"),
  jwt_refresh_secret: required("JWT_REFRESH_SECRET"),
  jwt_access_expires_in: required("JWT_ACCESS_EXPIRES_IN"),
  jwt_refresh_expires_in: required("JWT_REFRESH_EXPIRES_IN"),

  google_client_id: required("GOOGLE_CLIENT_ID"),
  google_client_secret: required("GOOGLE_CLIENT_SECRET"),

  bkash_base_url: required("BKASH_BASE_URL"),
  bkash_username: required("BKASH_USERNAME"),
  bkash_password: required("BKASH_PASSWORD"),
  bkash_app_key: required("BKASH_APP_KEY"),
  bkash_app_secret: required("BKASH_APP_SECRET"),
  bkash_callback_url: required("BKASH_CALLBACK_URL"),

  redis_user: required("REDIS_USER"),
  redis_password: required("REDIS_PASSWORD"),
  redis_host: required("REDIS_HOST"),
  redis_port: required("REDIS_PORT"),

  smtp_user: required("SMTP_USER"),
  email_sender: required("EMAIL_SENDER"),
  smtp_password: required("SMTP_PASSWORD"),
  smtp_host: process.env.SMTP_HOST || "smtp.gmail.com",
  smtp_port: Number(process.env.SMTP_PORT || "465"),
  // When true and SMTP is unavailable, verification OTPs are returned in the API
  // response so registration flows still work (used for the live Render demo).
  email_fail_open: process.env.EMAIL_FAIL_OPEN !== "false",
  // Optional HTTPS email-API fallback (used when SMTP is blocked, e.g. from Render).
  resend_api_key: process.env.RESEND_API_KEY,
  // Brevo (sendinblue) also works as an HTTPS fallback and allows sending from a
  // verified personal email (no custom domain required), unlike Resend.
  brevo_api_key: process.env.BREVO_API_KEY,

  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,

  // Seed configs
  run_seeds: process.env.RUN_SEEDS,

  seed_admin_email: process.env.SEED_ADMIN_EMAIL,
  seed_admin_password: required("SEED_ADMIN_PASSWORD"),
  seed_admin_first_name: process.env.SEED_ADMIN_FIRST_NAME,
  seed_admin_last_name: process.env.SEED_ADMIN_LAST_NAME,
  seed_provider_email: process.env.SEED_PROVIDER_EMAIL,
  seed_provider_password: process.env.SEED_PROVIDER_PASSWORD,
  seed_provider_first_name: process.env.SEED_PROVIDER_FIRST_NAME,
  seed_provider_last_name: process.env.SEED_PROVIDER_LAST_NAME,
  seed_consumer_email: process.env.SEED_CONSUMER_EMAIL,
  seed_consumer_password: process.env.SEED_CONSUMER_PASSWORD,
  seed_consumer_first_name: process.env.SEED_CONSUMER_FIRST_NAME,
  seed_consumer_last_name: process.env.SEED_CONSUMER_LAST_NAME,
  seed_operator_email: process.env.SEED_OPERATOR_EMAIL,
  seed_operator_password: process.env.SEED_OPERATOR_PASSWORD,
  seed_operator_first_name: process.env.SEED_OPERATOR_FIRST_NAME,
  seed_operator_last_name: process.env.SEED_OPERATOR_LAST_NAME,
};
