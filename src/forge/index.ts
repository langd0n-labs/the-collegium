import { createRedis } from "../shared/redis.js";
import { ForgeWorker } from "./forge-worker.js";

const redis = createRedis();
const worker = await ForgeWorker.create(redis);

worker.run().catch((error) => {
  console.error("Forge failed", error);
  process.exit(1);
});
