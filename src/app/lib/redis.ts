import { createClient } from "redis";
import config from "../config";

const MAX_RECONNECT_DELAY_MS = 30_000;

export const redisClient = createClient({
  username: config.redis_user,
  password: config.redis_password,
  socket: {
    host: config.redis_host,
    port: Number(config.redis_port),
    connectTimeout: 10_000,
    reconnectStrategy: (retries) => Math.min(2 ** retries * 500, MAX_RECONNECT_DELAY_MS),
  },
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err.message);
});
