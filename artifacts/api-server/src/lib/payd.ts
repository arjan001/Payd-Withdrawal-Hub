import axios, { type AxiosInstance } from "axios";
import { logger } from "./logger";

const AUTH_BASE = "https://auth.payd.money";
const API_BASE = "https://api.payd.money";

interface AuthToken {
  token: string;
  expiresAt: number;
}

let cachedToken: AuthToken | null = null;

interface LoginAttempt {
  url: string;
  payload: Record<string, string | undefined>;
  headers?: Record<string, string>;
}

async function tryLogin(attempt: LoginAttempt): Promise<string | null> {
  try {
    const res = await axios.post(attempt.url, attempt.payload, {
      headers: { "Content-Type": "application/json", ...(attempt.headers ?? {}) },
      timeout: 15000,
      validateStatus: (s) => s < 500,
    });

    if (res.status >= 400) {
      logger.debug({ status: res.status, data: res.data, url: attempt.url }, "Login attempt failed");
      return null;
    }

    const token =
      res.headers["x-auth-token"] ||
      res.headers["x-session-token"] ||
      res.headers["authorization"] ||
      res.data?.token ||
      res.data?.access_token ||
      res.data?.auth_token ||
      res.data?.data?.token ||
      res.data?.data?.access_token ||
      res.data?.data?.auth_token;

    if (token) {
      logger.info({ url: attempt.url }, "Payd auth successful");
      return String(token).replace(/^Bearer\s+/i, "");
    }

    logger.debug({ status: res.status, data: res.data, url: attempt.url }, "Login response had no token");
    return null;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      logger.debug({ status: err.response?.status, data: err.response?.data, url: attempt.url }, "Login attempt error");
    }
    return null;
  }
}

async function getAuthToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const username = process.env["PAYD_USERNAME"];
  const password = process.env["PAYD_PASSWORD"];
  const apiSecret = process.env["PAYD_API_SECRET"];

  if (!username || !password) {
    throw new Error("PAYD_USERNAME and PAYD_PASSWORD must be set");
  }

  // If the API secret looks like a JWT or long token, try it directly first
  if (apiSecret && apiSecret.length > 32) {
    logger.info("Trying PAYD_API_SECRET as direct bearer token");
    const testClient = axios.create({
      baseURL: API_BASE,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiSecret}`,
        "x-auth-token": apiSecret,
        "x-api-key": apiSecret,
      },
    });
    try {
      const testRes = await testClient.get("/v2/accounts/me", {
        validateStatus: (s) => s < 500,
      });
      if (testRes.status < 400) {
        logger.info("PAYD_API_SECRET works as direct token");
        cachedToken = { token: apiSecret, expiresAt: now + 3600_000 };
        return apiSecret;
      }
    } catch {
      // not a direct token
    }
  }

  const basePayload = { username, password, api_secret: apiSecret };
  const keyPayload = { api_key: username, api_secret: apiSecret ?? password, username, password };

  const attempts: LoginAttempt[] = [
    // Standard auth server paths
    { url: `${AUTH_BASE}/api/v2/auth/login`, payload: basePayload },
    { url: `${AUTH_BASE}/api/v1/login`, payload: basePayload },
    { url: `${AUTH_BASE}/api/v2/login`, payload: basePayload },
    { url: `${AUTH_BASE}/auth/login`, payload: basePayload },
    { url: `${AUTH_BASE}/login`, payload: basePayload },
    // API key specific paths
    { url: `${AUTH_BASE}/api/v1/apikeys/login`, payload: keyPayload },
    { url: `${AUTH_BASE}/api/v2/apikeys/auth`, payload: keyPayload },
    // V1 API server paths
    { url: `${API_BASE}/v1/auth/login`, payload: basePayload },
    { url: `${API_BASE}/v1/login`, payload: basePayload },
    { url: `${API_BASE}/v1/users/login`, payload: basePayload },
    // V2 API server paths
    { url: `${API_BASE}/v2/auth/login`, payload: basePayload },
    { url: `${API_BASE}/v2/login`, payload: basePayload },
    // API key auth
    { url: `${API_BASE}/v1/apikeys/authenticate`, payload: keyPayload },
    { url: `${API_BASE}/v2/apikeys/authenticate`, payload: keyPayload },
  ];

  logger.info("Attempting Payd authentication across multiple endpoints");

  for (const attempt of attempts) {
    const token = await tryLogin(attempt);
    if (token) {
      cachedToken = { token, expiresAt: now + 3600_000 };
      return token;
    }
  }

  throw new Error(
    "Payd authentication failed: could not authenticate with any known endpoint. " +
      "The account may be locked out or the credentials may need OTP verification."
  );
}

export function invalidateToken(): void {
  cachedToken = null;
}

export async function paydClient(): Promise<AxiosInstance> {
  const token = await getAuthToken();
  return axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      "x-auth-token": token,
      Authorization: `Bearer ${token}`,
      "x-api-key": token,
    },
  });
}

export async function paydGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const client = await paydClient();
  try {
    const res = await client.get<T>(path, { params });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      invalidateToken();
    }
    throw err;
  }
}

export async function paydPost<T>(path: string, body?: unknown): Promise<T> {
  const client = await paydClient();
  try {
    const res = await client.post<T>(path, body);
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      invalidateToken();
    }
    throw err;
  }
}
