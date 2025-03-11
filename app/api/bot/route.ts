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
const hf = new HfInference(process.env.HUGGINGFACE_API_TOKEN2 || "");

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Привет. Я превращаю ваши аудиосообщения в текст! Просто отправьте мне голосовое сообщение, и я быстро расшифрую его для вас. Удобно для заметок, переписки или когда лень печатать. Поддерживаю разные языки — попробуйте прямо сейчас!",
  );
});

bot.on("message:text", async (ctx) => {
  const chatId = ctx.chat.id;
  //await ctx.reply(`Ваш чат ID: ${chatId}`);
});

// Обработка голосовых сообщений с Whisper
bot.on("message:voice", async (ctx) => {
  let fileUrl: string | undefined;

  try {
    // Этап 1: Получение информации о файле
    const file = await ctx.getFile();
    if (!file.file_path) {
      throw new Error("Не удалось получить путь к файлу");
    }

    // Формирование URL
    fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    // Этап 2: Проверка размера файла
    if (file.file_size && file.file_size > 15 * 1024 * 1024) {
      throw new Error("Голосовое сообщение слишком большое (макс. 15 МБ)");
    }

    // Этап 3: Загрузка файла
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

    // Логирование успешной обработки
    console.log("Успешная обработка голосового сообщения:", {
      fileUrl,
      transcription: transcription.text,
      chatId: ctx.chat?.id,
      messageId: ctx.message?.message_id,
      fileSize: file.file_size,
      timestamp: new Date().toISOString(),
    });

    // Этап 6: Отправка ответа
    await ctx.reply(transcription.text, {
      reply_to_message_id: ctx.message.message_id,
    });
  } catch (error: unknown) {
    // Формирование сообщения об ошибке
    const errorMessage =
      error instanceof Error ? error.message : "Неизвестная ошибка";

    // Логирование ошибки с полной информацией
    console.error("Ошибка обработки голосового сообщения:", {
      message: errorMessage,
      fileUrl,
      stack: error instanceof Error ? error.stack : undefined,
      ctx: {
        chatId: ctx.chat?.id,
        messageId: ctx.message?.message_id,
      },
      timestamp: new Date().toISOString(),
    });

    // Отправка общего сообщения в Telegram без деталей
    await ctx.reply(
      "Упс, что-то пошло не так при обработке голосового сообщения!",
      {
        reply_to_message_id: ctx.message.message_id,
      },
    );
  }
});

export const POST = webhookCallback(bot, "std/http");
