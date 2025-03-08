import { Bot } from "grammy";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || "");

async function setupWebhook() {
  try {
    const url = `${process.env.NEXT_PUBLIC_URL}/api/bot`;
    await bot.api.setWebhook(url);
    console.log(`Webhook set to ${url}`);
    const webhookInfo = await bot.api.getWebhookInfo();
    console.log("Webhook info:", webhookInfo);
  } catch (error) {
    console.error("Failed to set webhook:", error);
  }
}

setupWebhook();