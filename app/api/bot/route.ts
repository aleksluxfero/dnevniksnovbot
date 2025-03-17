import { webhookCallback } from "grammy";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { Bot } from "grammy";
import { HfInference } from "@huggingface/inference";

const token = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = -1002348258704; // Замените на ID вашей группы

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable not found.");
}

const bot = new Bot(token);
const hf = new HfInference(process.env.HUGGINGFACE_API_TOKEN2 || "");

// Обработка команды /start только в нужной группе
bot.command("start", async (ctx) => {
  if (ctx.chat.id !== ALLOWED_CHAT_ID) {
    return; // Молча игнорируем, если не та группа
  }
  await ctx.reply("Привет. Я превращаю ваши аудиосообщения в текст!");
});

// Обработка голосовых сообщений только в нужной группе
bot.on("message:voice", async (ctx) => {
  if (ctx.chat.id !== ALLOWED_CHAT_ID) {
    console.log("Сообщение вне разрешённой группы:", ctx.chat.id);
    return; // Молча игнорируем, если не та группа
  }

  let fileUrl: string | undefined;
  try {
    const file = await ctx.getFile();
    if (!file.file_path) throw new Error("Не удалось получить путь к файлу");

    fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    if (file.file_size && file.file_size > 15 * 1024 * 1024) {
      throw new Error("Голосовое сообщение слишком большое (макс. 15 МБ)");
    }

    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`HTTP ошибка ${response.status}`);

    const audioBuffer = await response.arrayBuffer();
    if (!audioBuffer.byteLength) throw new Error("Получен пустой аудио буфер");

    const transcription = await hf.automaticSpeechRecognition({
      model: "openai/whisper-large-v3",
      data: audioBuffer,
      return_timestamps: true, // Добавляем поддержку длинных аудио
    });

    if (!transcription.text) throw new Error("Не удалось получить текст");

    await ctx.reply(transcription.text, {
      reply_to_message_id: ctx.message.message_id,
    });
  } catch (error) {
    console.error("Ошибка:", error);
    await ctx.reply("Упс, что-то пошло не так!", {
      reply_to_message_id: ctx.message.message_id,
    });
  }
});

export const POST = webhookCallback(bot, "std/http");
