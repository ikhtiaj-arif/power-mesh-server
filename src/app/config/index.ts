import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  node_env: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  frontend_url: process.env.FRONTEND_URL,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS || "10",

  jwt_access_secret: process.env.JWT_ACCESS_SECRET!,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET!,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN!,
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN!,

  google_client_id: process.env.GOOGLE_CLIENT_ID!,
  google_client_secret: process.env.GOOGLE_CLIENT_SECRET!,

  redis_user: process.env.REDIS_USER!,
  redis_password: process.env.REDIS_PASSWORD!,
  redis_host: process.env.REDIS_HOST!,
  redis_port: process.env.REDIS_PORT!,

  smtp_user: process.env.SMTP_USER!,
  email_sender: process.env.EMAIL_SENDER!,
  smtp_password: process.env.SMTP_PASSWORD!,

  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY!,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET!,

  // Seed configs
  seed_admin_email: process.env.SEED_ADMIN_EMAIL,
  seed_admin_password: process.env.SEED_ADMIN_PASSWORD,
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
};
