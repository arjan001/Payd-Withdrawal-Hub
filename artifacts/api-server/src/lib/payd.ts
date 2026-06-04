import axios from "axios";
import { db, credentialsTable, ensureCredentialsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const API_BASE = "https://api.payd.money";

export interface PaydUserCredentials {
  username: string;
  password: string;
  accountUsername: string;
  withdrawalsEnabled: boolean;
  isActive: boolean;
}

export interface PaydClient {
  get: <T>(path: string, params?: Record<string, unknown>) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  accountUsername: string;
  withdrawalsEnabled: boolean;
  isActive: boolean;
}

function buildClient(creds: PaydUserCredentials): PaydClient {
  const instance = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    auth: { username: creds.username, password: creds.password },
    headers: { "Content-Type": "application/json" },
  });

  return {
    get: async <T>(path: string, params?: Record<string, unknown>) => {
      const res = await instance.get<T>(path, { params });
      return res.data;
    },
    post: async <T>(path: string, body?: unknown) => {
      const res = await instance.post<T>(path, body);
      return res.data;
    },
    accountUsername: creds.accountUsername,
    withdrawalsEnabled: creds.withdrawalsEnabled,
    isActive: creds.isActive,
  };
}

function rowToCredentials(row: typeof credentialsTable.$inferSelect): PaydUserCredentials {
  return {
    username: row.paydUsername,
    password: row.paydPassword,
    accountUsername: row.paydAccountUsername,
    withdrawalsEnabled: row.withdrawalsEnabled,
    isActive: row.isActive,
  };
}

/**
 * Returns the Payd client for a specific logged-in user (by their user_id).
 * This is the primary credential lookup for all multi-tenant API operations.
 */
export async function getPaydClientForUser(userId: number): Promise<PaydClient | null> {
  try {
    await ensureCredentialsTable();
    const rows = await db
      .select()
      .from(credentialsTable)
      .where(eq(credentialsTable.userId, userId))
      .limit(1);
    const row = rows[0];
    if (row) return buildClient(rowToCredentials(row));
  } catch (err) {
    logger.warn({ err, userId }, "Failed to read credentials from DB for user");
  }
  return null;
}

/**
 * Credentials supplied through environment variables. Used as a fallback
 * on the /test admin panel and legacy paths only.
 */
export function getEnvCredentials(): PaydUserCredentials | null {
  const username = process.env["PAYD_USERNAME"];
  const password = process.env["PAYD_PASSWORD"];
  const accountUsername = process.env["PAYD_ACCOUNT_USERNAME"] || username;
  if (!username || !password || !accountUsername) return null;
  return {
    username,
    password,
    accountUsername,
    withdrawalsEnabled: true,
    isActive: true,
  };
}

/**
 * @deprecated Use getPaydClientForUser(userId) instead.
 * Kept for the admin /test panel which still uses account-based lookup.
 */
export async function getPaydClient(accountUsername?: string): Promise<PaydClient | null> {
  if (accountUsername) {
    try {
      await ensureCredentialsTable();
      const rows = await db
        .select()
        .from(credentialsTable)
        .where(eq(credentialsTable.paydAccountUsername, accountUsername))
        .limit(1);
      const row = rows[0];
      if (row) return buildClient(rowToCredentials(row));
    } catch (err) {
      logger.warn({ err }, "Failed to read credentials from DB for account", accountUsername);
    }
  }
  const envCreds = getEnvCredentials();
  if (envCreds && (!accountUsername || envCreds.accountUsername === accountUsername)) {
    return buildClient(envCreds);
  }
  return null;
}

/**
 * @deprecated Use getPaydClientForUser(userId) instead.
 * Kept for backward compatibility; returns the first active credential row.
 */
export async function getActivePaydClient(): Promise<PaydClient | null> {
  try {
    await ensureCredentialsTable();
    const rows = await db
      .select()
      .from(credentialsTable)
      .where(eq(credentialsTable.isActive, true))
      .limit(1);
    const row = rows[0];
    if (row) return buildClient(rowToCredentials(row));
  } catch (err) {
    logger.warn({ err }, "Failed to read active credentials from DB");
  }
  const envCreds = getEnvCredentials();
  if (envCreds) return buildClient(envCreds);
  return null;
}

export function getCallbackBase(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) {
    const primary = domains.split(",")[0]?.trim();
    if (primary) return `https://${primary}`;
  }
  const devDomain = process.env["REPLIT_DEV_DOMAIN"];
  if (devDomain) return `https://${devDomain}`;
  const netlifyUrl = process.env["URL"];
  if (netlifyUrl) return netlifyUrl.replace(/\/+$/, "");
  return "https://localhost";
}
