import { Bot } from "grammy";
import { webhookCallback } from "grammy";
import { HfInference } from "@huggingface/inference";
import { NextRequest } from "next/server";

// Настройки для Vercel
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Инициализация бота и Hugging Face
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable not found.");
}

const bot = new Bot(token);
const hf = new HfInference(process.env.HUGGINGFACE_API_TOKEN || "");

// Команда /start
bot.command("start", async (ctx) => {
  await ctx.reply(
    "Привет! Я бот с Whisper на TypeScript. Отправь мне голосовое сообщение, и я преобразую его в текст!"
  );
});

// Обработка голосовых сообщений с Whisper
bot.on("message:voice", async (ctx) => {
  try {
    const file = await ctx.getFile();
    if (file.file_size && file.file_size > 5 * 1024 * 1024) {
      await ctx.reply("Голосовое сообщение слишком большое (макс. 5 МБ)");
      return;
    }

    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const audioBuffer = await response.arrayBuffer();

    const transcription = await hf.automaticSpeechRecognition({
      model: "openai/whisper-large-v3",
      data: audioBuffer,
    });

    await ctx.reply(`Твой текст: ${transcription.text}`);
  } catch (error) {
    console.log(error);
    await ctx.reply("Упс, не смог обработать голосовое сообщение!");
  }
});

// Обработка текстовых сообщений (как в вашем примере)
bot.on("message:text", async (ctx) => {
  const chatId = ctx.chat.id;
  await ctx.reply(`Твой чат ID: ${chatId}`);
});

// Экспорт обработчика для Vercel
export const POST = async (req: NextRequest) => {
  try {
    return await webhookCallback(bot, "nextjs")(req);
  } catch (error) {
    console.log(error);
    return new Response("Ошибка сервера", { status: 500 });
  }
};