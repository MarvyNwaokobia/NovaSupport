import "dotenv/config";
import { logger } from "./logger.js";

const REQUIRED_ENV_VARS = ["DATABASE_URL", "DIRECT_URL"];

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    logger.error({ variable: key }, `Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

import { app } from "./app.js";

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  logger.info({ port }, `NovaSupport backend listening on http://localhost:${port}`);
});
