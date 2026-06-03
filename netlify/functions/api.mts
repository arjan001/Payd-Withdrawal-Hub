import serverless from "serverless-http";
import app from "../../artifacts/api-server/src/app";

// Wrap the Express API server so it runs as a Netlify Function.
// The netlify.toml redirect forwards every /api/* request here.
export const handler = serverless(app);
