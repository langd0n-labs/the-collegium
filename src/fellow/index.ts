import { createRedis } from "../shared/redis.js";
import { PersonaWorker } from "./persona-worker.js";

const redis = createRedis();
const worker = await PersonaWorker.create(redis);

worker.run().catch((error) => {
  console.error("Fellow Worker failed", error);
  process.exit(1);
});
