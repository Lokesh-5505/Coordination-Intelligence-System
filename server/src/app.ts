import "dotenv/config";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  ...(process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(",").map((s) => s.trim())
    : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl, mobile, server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes("*") ||
        /\.vercel\.app(:[0-9]+)?$/.test(origin) ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        !process.env.CLIENT_ORIGIN ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Support both /api-prefixed routes and root-relative routes
app.use("/api", router);
app.use(router);

// Ensure 404 responses are always structured JSON, never HTML or empty bodies
app.use((req, res) => {
  res.status(404).json({
    error: `Cannot ${req.method} ${req.originalUrl}`,
    status: 404,
  });
});

// Central error handler returning structured JSON
app.use((err: any, req: any, res: any, next: any) => {
  logger.error({ err }, "Unhandled server error");
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    status: err.status || 500,
  });
});

export default app;
