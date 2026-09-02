import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
	node_env: process.env.NODE_ENV,
	port: process.env.PORT,
	database_url: process.env.DATABASE_URL,
	frontend_url: process.env.FRONTEND_URL,
	bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS || "10",
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

