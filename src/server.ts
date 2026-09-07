import dns from "node:dns";
import app from "./app";
import config from "./app/config";
import { transporter } from "./app/lib/nodemailer";
import { prisma } from "./app/lib/primsa";
import { redisClient } from "./app/lib/redis";
import { runSeeds } from "./utils/seed";

// Render has no IPv6 egress; prefer IPv4 for all outbound connections
// (SMTP, Redis, etc.) so DNS ads of the network-unreachable family are never used.
dns.setDefaultResultOrder("ipv4first");

const PORT = config.port;

/**
 * Attempts to connect to an external service within a bounded time.
 * Failures are logged as warnings and never crash the process, so the
 * HTTP server can come up immediately even if a dependency is briefly
 * unavailable (e.g. Render cold starts, SMTP being slow).
 */
const connectWithTimeout = async (
  label: string,
  fn: () => Promise<unknown>,
  timeoutMs: number,
): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} connection timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    await Promise.race([fn(), timeout]);
    console.log(`${label} connected successfully.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: ${label} unavailable: ${message}`);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const main = () => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  const shouldSeed = config.node_env === "development" || config.run_seeds === "true";
  if (shouldSeed) {
    runSeeds().catch((error) => {
      console.error("Seed process failed:", error);
    });
  }

  void Promise.allSettled([
    connectWithTimeout("Database", () => prisma.$connect(), 15_000),
    connectWithTimeout("Redis", () => redisClient.connect(), 15_000),
    connectWithTimeout("Nodemailer", () => transporter.verify(), 15_000),
  ]);
};

main();
