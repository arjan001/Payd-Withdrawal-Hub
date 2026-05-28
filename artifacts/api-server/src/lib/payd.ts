import axios, { type AxiosInstance } from "axios";

const API_BASE = "https://api.payd.money";

function getCredentials(): { username: string; password: string; accountUsername: string } {
  const username = process.env["PAYD_USERNAME"];
  const password = process.env["PAYD_PASSWORD"];
  const accountUsername = process.env["PAYD_ACCOUNT_USERNAME"];

  if (!username || !password) {
    throw new Error("PAYD_USERNAME and PAYD_PASSWORD must be set");
  }
  if (!accountUsername) {
    throw new Error("PAYD_ACCOUNT_USERNAME must be set (your Payd profile username, e.g. 'techlink')");
  }

  return {
    username,
    password,
    accountUsername,
  };
}

export function paydClient(): AxiosInstance {
  const { username, password } = getCredentials();
  return axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    auth: { username, password },
    headers: { "Content-Type": "application/json" },
  });
}

export function getAccountUsername(): string {
  return getCredentials().accountUsername;
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
  const client = paydClient();
  const res = await client.get<T>(path, { params });
  return res.data;
}

export async function paydPost<T>(path: string, body?: unknown): Promise<T> {
  const client = paydClient();
  const res = await client.post<T>(path, body);
  return res.data;
}
