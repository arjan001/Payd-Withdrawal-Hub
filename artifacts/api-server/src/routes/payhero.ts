import { Router, type IRouter } from "express";
import axios from "axios";
import { InitiatePayheroWithdrawBody } from "@workspace/api-zod";
import { payheroGet, payheroPost, getChannelId, getPayheroCallbackBase } from "../lib/payhero";

const router: IRouter = Router();

function payheroError(err: unknown): { status: number; message: string } {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 500;
    const data = err.response?.data;
    const message =
      (typeof data === "object" && data !== null && "message" in data
        ? String((data as Record<string, unknown>)["message"])
        : null) ||
      (typeof data === "object" && data !== null && "error_message" in data
        ? String((data as Record<string, unknown>)["error_message"])
        : null) ||
      err.message ||
      "Unknown error";
    return { status, message };
  }
  return { status: 500, message: String(err) };
}

// GET /api/payhero/wallet — fetch PayHero wallet balances
router.get("/payhero/wallet", async (req, res): Promise<void> => {
  try {
    const channelId = getChannelId();

    let paymentChannelBalance: number | null = null;
    let channelName: string | null = null;

    try {
      const channelData = await payheroGet<Record<string, unknown>>(
        `/api/v2/payment_channels/${channelId}`,
      );
      req.log.debug({ channelData }, "PayHero channel data");
      paymentChannelBalance = Number(
        channelData["balance_plain"] ?? channelData["balance"] ?? 0,
      ) || null;
      channelName = (channelData["description"] ?? channelData["name"] ?? null) as string | null;
    } catch (err) {
      req.log.warn({ err }, "Could not fetch PayHero payment channel balance");
    }

    let serviceWalletBalance: number | null = null;
    try {
      const walletData = await payheroGet<Record<string, unknown>>(`/api/v2/wallets`, {
        wallet_type: "service_wallet",
      });
      req.log.debug({ walletData }, "PayHero service wallet data");
      serviceWalletBalance = Number(
        walletData["available_balance"] ?? walletData["balance"] ?? 0,
      ) || null;
    } catch (err) {
      req.log.warn({ err }, "Could not fetch PayHero service wallet balance");
    }

    res.json({
      channel_id: channelId,
      channel_name: channelName,
      payment_channel_balance: paymentChannelBalance,
      service_wallet_balance: serviceWalletBalance,
      currency: "KES",
      connected: true,
    });
  } catch (err) {
    const { status, message } = payheroError(err);
    req.log.error({ err }, "Failed to fetch PayHero wallet");
    res.status(status).json({ error: "Failed to fetch wallet", message });
  }
});

// POST /api/payhero/withdraw — withdraw from PayHero wallet to mobile
router.post("/payhero/withdraw", async (req, res): Promise<void> => {
  try {
    const parsed = InitiatePayheroWithdrawBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { phone_number, amount, network_code = "63902", external_reference } = parsed.data;
    const channelId = getChannelId();
    const callbackUrl = `${getPayheroCallbackBase()}/api/webhook/payhero`;

    const ref = external_reference ?? `WD-${Date.now()}`;

    const rawData = await payheroPost<Record<string, unknown>>("/api/v2/withdraw", {
      external_reference: ref,
      amount,
      phone_number,
      network_code,
      callback_url: callbackUrl,
      channel_id: channelId,
    });

    req.log.info({ rawData }, "PayHero withdraw response");

    res.json({
      success: rawData["success"] !== false,
      reference: (rawData["reference"] ?? rawData["checkout_request_id"] ?? ref) as string | null,
      message: String(rawData["message"] ?? rawData["description"] ?? "Withdrawal initiated"),
      status: (rawData["status"] ?? null) as string | null,
    });
  } catch (err) {
    const { status, message } = payheroError(err);
    req.log.error({ err }, "Failed to initiate PayHero withdrawal");
    res.status(status).json({ error: "Failed to initiate withdrawal", message });
  }
});

// POST /api/webhook/payhero — receive PayHero callbacks
router.post("/webhook/payhero", (req, res): void => {
  const payload = req.body as Record<string, unknown>;
  req.log.info({ payload }, "PayHero webhook received");
  res.status(200).json({ received: true });
});

export default router;
