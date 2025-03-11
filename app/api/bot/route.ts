import { webhookCallback } from "grammy";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { Bot } from "grammy";
import { HfInference } from "@huggingface/inference";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable not found.");
}

const bot = new Bot(token);
const hf = new HfInference(process.env.HUGGINGFACE_API_TOKEN || "");

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Привет! Я ваш новый бот на грамми, написанный на TypeScript!",
  );
});

bot.on("message:text", async (ctx) => {
  const chatId = ctx.chat.id;
  await ctx.reply(`Ваш чат ID: ${chatId}`);
});

// Обработка голосовых сообщений с Whisper
bot.on("message:voice", async (ctx) => {
  try {
    // Этап 1: Получение информации о файле
    const file = await ctx.getFile();
    if (!file.file_path) {
      throw new Error("Не удалось получить путь к файлу");
    }

    // Этап 2: Проверка размера файла
    if (file.file_size && file.file_size > 15 * 1024 * 1024) {
      await ctx.reply("Голосовое сообщение слишком большое (макс. 15 МБ)");
      return;
    }

    // Этап 3: Формирование URL и загрузка файла
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    let response;
    try {
      response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(
          `HTTP ошибка ${response.status}: ${response.statusText}`,
        );
      }
    } catch (fetchError: unknown) {
      const errorMessage =
        fetchError instanceof Error
          ? fetchError.message
          : "Неизвестная ошибка при загрузке файла";
      throw new Error(`Ошибка при загрузке файла: ${errorMessage}`);
    }

    // Этап 4: Получение буфера
    const audioBuffer = await response.arrayBuffer();
    if (!audioBuffer.byteLength) {
      throw new Error("Получен пустой аудио буфер");
    }

    // Этап 5: Транскрипция
    const transcription = await hf.automaticSpeechRecognition({
      model: "openai/whisper-large-v3",
      data: audioBuffer,
    });

    if (!transcription.text) {
      throw new Error("Не удалось получить текст транскрипции");
    }

    // Этап 6: Отправка ответа
    await ctx.reply(transcription.text, {
      reply_to_message_id: ctx.message.message_id,
    });
  } catch (error: unknown) {
    // Детальная информация только в консоль
    const errorMessage =
      error instanceof Error ? error.message : "Неизвестная ошибка";

    console.error("Детальная ошибка обработки голосового сообщения:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      ctx: {
        chatId: ctx.chat?.id,
        messageId: ctx.message?.message_id,
      },
    });

    // Только общее сообщение в Telegram
    await ctx.reply(
      "Упс, что-то пошло не так при обработке голосового сообщения!",
      {
        reply_to_message_id: ctx.message.message_id,
      },
    );
  }
});

export const POST = webhookCallback(bot, "std/http");
