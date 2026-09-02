import bcrypt from "bcryptjs";
import { prisma } from "../lib/primsa";
import config from "../config";

export const seedAdmin = async () => {
	try {
		const email = config.seed_admin_email;
		const password = config.seed_admin_password;
		const firstName = config.seed_admin_first_name;
		const lastName = config.seed_admin_last_name;

		if (!email || !password || !firstName || !lastName) {
			throw new Error("Admin Seed Config Missing In Env File!");
		}

		const existingUser = await prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) {
			console.log("Admin User Already Exists:", email);
			return existingUser;
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const adminUser = await prisma.user.create({
			data: {
				email,
				firstName,
				lastName,
				password: hashedPassword,
				role: "OPERATOR",
				emailVerified: true,
				operator: {
					create: {
						roleLevel: "admin",
						isAdmin: true,
					},
				},
			},
		});

		console.log("Admin User Created:", adminUser.email);
		return adminUser;
	} catch (error) {
		console.log("Error Seeding Admin:", error);
		throw error;
	}
};

export const seedProvider = async () => {
	try {
		const email = config.seed_provider_email;
		const password = config.seed_provider_password;
		const firstName = config.seed_provider_first_name;
		const lastName = config.seed_provider_last_name;

		if (!email || !password || !firstName || !lastName) {
			throw new Error("Provider Seed Config Missing In Env File!");
		}

		const existingUser = await prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) {
			console.log("Provider User Already Exists:", email);
			return existingUser;
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const providerUser = await prisma.user.create({
			data: {
				email,
				firstName,
				lastName,
				password: hashedPassword,
				role: "PROVIDER",
				provider: {
					create: {
						companyName: "Solar Power Ltd",
						licenseNumber: "LIC123456",
						resourceType: "SOLAR_BESS",
						capacityKw: 500,
						address: "Dhaka South",
						contactPerson: `${firstName} ${lastName}`,
						contactPhone: "+8801700000001",
						verified: true,
						verifiedAt: new Date(),
					},
				},
			},
		});

		console.log("Provider User Created:", providerUser.email);
		return providerUser;
	} catch (error) {
		console.log("Error Seeding Provider:", error);
		throw error;
	}
};

export const seedConsumer = async () => {
	try {
		const email = config.seed_consumer_email;
		const password = config.seed_consumer_password;
		const firstName = config.seed_consumer_first_name;
		const lastName = config.seed_consumer_last_name;

		if (!email || !password || !firstName || !lastName) {
			throw new Error("Consumer Seed Config Missing In Env File!");
		}

		const existingUser = await prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) {
			console.log("Consumer User Already Exists:", email);
			return existingUser;
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const consumerUser = await prisma.user.create({
			data: {
				email,
				firstName,
				lastName,
				password: hashedPassword,
				role: "CONSUMER",
				consumer: {
					create: {
						organizationName: "Test Hospital",
						criticalLoadKw: 150,
						address: "Dhaka South",
						contactPerson: `${firstName} ${lastName}`,
						contactPhone: "+8801700000002",
					},
				},
			},
		});

		console.log("Consumer User Created:", consumerUser.email);
		return consumerUser;
	} catch (error) {
		console.log("Error Seeding Consumer:", error);
		throw error;
	}
};

export const runSeeds = async () => {
	try {
		console.log("Starting database seeds...");

		await seedAdmin();
		await seedProvider();
		await seedConsumer();

		console.log("All seeds completed successfully!");
	} catch (error) {
		console.error("Seed process failed:", error);
	}
};