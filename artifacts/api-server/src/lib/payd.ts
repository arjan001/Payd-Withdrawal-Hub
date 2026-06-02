import axios, { type AxiosInstance } from "axios";
import { db, credentialsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "./logger";

const API_BASE = "https://api.payd.money";

interface PaydCredentials {
  username: string;
  password: string;
  accountUsername: string;
}

export async function getCredentials(): Promise<PaydCredentials> {
  try {
    const rows = await db
      .select()
      .from(credentialsTable)
      .orderBy(desc(credentialsTable.updatedAt))
      .limit(1);
    const row = rows[0];
    if (row?.paydUsername && row?.paydPassword && row?.paydAccountUsername) {
      return {
        username: row.paydUsername,
        password: row.paydPassword,
        accountUsername: row.paydAccountUsername,
      };
    }
  } catch (err) {
    logger.warn({ err }, "Failed to read credentials from DB, falling back to env");
  }

  const username = process.env["PAYD_USERNAME"];
  const password = process.env["PAYD_PASSWORD"];
  const accountUsername = process.env["PAYD_ACCOUNT_USERNAME"];

  if (!username || !password) {
    throw new Error("Payd credentials not configured. Go to Settings to add your API credentials.");
  }
  if (!accountUsername) {
    throw new Error("PAYD_ACCOUNT_USERNAME not configured. Go to Settings to add your API credentials.");
  }

  return { username, password, accountUsername };
}

export async function paydClient(): Promise<AxiosInstance> {
  const { username, password } = await getCredentials();
  return axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    auth: { username, password },
    headers: { "Content-Type": "application/json" },
  });
}

export async function getAccountUsername(): Promise<string> {
  const { accountUsername } = await getCredentials();
  return accountUsername;
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

export async function paydGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const client = await paydClient();
  const res = await client.get<T>(path, { params });
  return res.data;
}

export async function paydPost<T>(path: string, body?: unknown): Promise<T> {
  const client = await paydClient();
  const res = await client.post<T>(path, body);
  return res.data;
}
