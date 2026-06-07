import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import adminRouter from "./routes/admin";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes first — MUST be before SPA fallback
app.use("/api", router);
// When deployed as a Netlify Function, requests may arrive under the
// function's own base path. Mount the same router there so the API works
// regardless of how the platform forwards the request.
app.use("/.netlify/functions/api", router);

// Admin panel routes at root level (/test/*)
app.use(adminRouter);

// Serve the built dashboard frontend
// __dirname = artifacts/api-server/dist, so ../../../ = workspace root
const dashboardDist = path.resolve(__dirname, "../../../artifacts/dashboard/dist/public");
app.use(express.static(dashboardDist));

// SPA fallback — return index.html for all non-API, non-test routes
// This must be last to avoid catching /test and /api routes
app.use((req: express.Request, res: express.Response) => {
  // If we get here, it's not an API/test route, so serve the SPA
  const indexHtml = path.join(dashboardDist, "index.html");
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

export default app;
