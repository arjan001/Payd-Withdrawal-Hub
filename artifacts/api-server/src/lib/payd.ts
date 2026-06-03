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
 * Credentials supplied through Netlify environment variables. This is the
 * persistent, server-side credential store the platform offers: the values are
 * set once (Site settings → Environment variables, or `netlify env:set`) and
 * survive every deploy and every function cold start — no ephemeral file or
 * database row required. It is used as a fallback so the dashboard keeps
 * working even before any credentials are saved through the UI (and regardless
 * of database state).
 *
 *   PAYD_USERNAME          – API key username
 *   PAYD_PASSWORD          – API key password
 *   PAYD_API_SECRET        – API secret (optional; Basic Auth does not use it)
 *   PAYD_ACCOUNT_USERNAME  – Payd profile username (falls back to PAYD_USERNAME)
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
    // Env-provided credentials are operator-set, so treat them as the live,
    // withdrawal-enabled account.
    withdrawalsEnabled: true,
    isActive: true,
  };
}

/**
 * Returns the system-wide active Payd client (used for balance / payin).
 * Falls back to credentials supplied via environment variables, and returns
 * null only when no credentials are available from either source.
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

/**
 * Returns a Payd client for a specific account username (used for withdrawals).
 * Falls back to environment-variable credentials when the database has no
 * matching row. Returns null if no credentials can be resolved.
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
      logger.warn({ err }, "Failed to read credentials from DB for user", accountUsername);
    }
  }
  // Fall back to env credentials when they match the requested account (or when
  // no specific account was requested).
  const envCreds = getEnvCredentials();
  if (envCreds && (!accountUsername || envCreds.accountUsername === accountUsername)) {
    return buildClient(envCreds);
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
