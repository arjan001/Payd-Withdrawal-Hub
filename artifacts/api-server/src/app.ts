import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve the built dashboard frontend
// __dirname = artifacts/api-server/dist, so ../../../ = workspace root
const dashboardDist = path.resolve(__dirname, "../../../artifacts/dashboard/dist/public");
app.use(express.static(dashboardDist));

// SPA fallback — return index.html for all non-API routes
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(dashboardDist, "index.html"));
});

export default app;
