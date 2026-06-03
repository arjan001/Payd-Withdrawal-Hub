import axios from "axios";
import { db, credentialsTable } from "@workspace/db";
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
 * Returns the system-wide active Payd client (used for balance / payin).
 * Returns null if no active credentials are set.
 */
export async function getActivePaydClient(): Promise<PaydClient | null> {
  try {
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
  return null;
}

/**
 * Returns a Payd client for a specific account username (used for withdrawals).
 * Returns null if no credentials found for that user.
 */
export async function getPaydClient(accountUsername?: string): Promise<PaydClient | null> {
  if (!accountUsername) return null;
  try {
    const rows = await db
      .select()
      .from(credentialsTable)
      .where(eq(credentialsTable.paydAccountUsername, accountUsername))
      .limit(1);
    const row = rows[0];
    if (row) return buildClient(rowToCredentials(row));
  } catch (err) {
    logger.warn({ err }, "Failed to read credentials from DB for user", accountUsername);
  }
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
  // Netlify exposes the deployed site URL via the URL env var.
  const netlifyUrl = process.env["URL"];
  if (netlifyUrl) return netlifyUrl.replace(/\/+$/, "");
  return "https://localhost";
}
