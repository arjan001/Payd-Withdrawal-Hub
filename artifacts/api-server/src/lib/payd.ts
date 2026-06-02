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
}

export interface PaydClient {
  get: <T>(path: string, params?: Record<string, unknown>) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  accountUsername: string;
  withdrawalsEnabled: boolean;
}

export async function lookupUserCredentials(accountUsername: string): Promise<PaydUserCredentials | null> {
  try {
    const rows = await db
      .select()
      .from(credentialsTable)
      .where(eq(credentialsTable.paydAccountUsername, accountUsername))
      .limit(1);
    const row = rows[0];
    if (row?.paydUsername && row?.paydPassword && row?.paydAccountUsername) {
      return {
        username: row.paydUsername,
        password: row.paydPassword,
        accountUsername: row.paydAccountUsername,
        withdrawalsEnabled: row.withdrawalsEnabled,
      };
    }
  } catch (err) {
    logger.warn({ err }, "Failed to read credentials from DB");
  }
  return null;
}

/**
 * Returns a Payd client for the given account username, or null if no
 * credentials are found in the DB. Never falls back to environment variables.
 */
export async function getPaydClient(accountUsername?: string): Promise<PaydClient | null> {
  if (!accountUsername) return null;

  const creds = await lookupUserCredentials(accountUsername);
  if (!creds) return null;

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
  };
}

export function getCallbackBase(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) {
    const primary = domains.split(",")[0]?.trim();
    if (primary) return `https://${primary}`;
  }
  const devDomain = process.env["REPLIT_DEV_DOMAIN"];
  if (devDomain) return `https://${devDomain}`;
  return "https://localhost";
}
