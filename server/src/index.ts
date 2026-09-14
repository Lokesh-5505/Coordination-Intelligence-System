import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort) || 5000;
const host = process.env["HOST"] || "0.0.0.0";

app.listen(port, host, () => {
  logger.info({ port, host }, `Server listening on ${host}:${port}`);
});
