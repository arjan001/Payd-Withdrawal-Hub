import axios, { type AxiosInstance } from "axios";

const API_BASE = "https://backend.payhero.co.ke";

function getConfig(): { authToken: string; channelId: number } {
  const authToken = process.env["PAYHERO_AUTH_TOKEN"];
  const channelIdStr = process.env["PAYHERO_CHANNEL_ID"];

  if (!authToken) {
    throw new Error("PAYHERO_AUTH_TOKEN must be set");
  }
  if (!channelIdStr) {
    throw new Error("PAYHERO_CHANNEL_ID must be set");
  }

  return { authToken, channelId: Number(channelIdStr) };
}

export function payheroClient(): AxiosInstance {
  const { authToken } = getConfig();
  return axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    headers: {
      Authorization: authToken,
      "Content-Type": "application/json",
    },
  });
}

export function getChannelId(): number {
  return getConfig().channelId;
}

export function getPayheroCallbackBase(): string {
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

export async function payheroGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const client = payheroClient();
  const res = await client.get<T>(path, { params });
  return res.data;
}

export async function payheroPost<T>(path: string, body?: unknown): Promise<T> {
  const client = payheroClient();
  const res = await client.post<T>(path, body);
  return res.data;
}
