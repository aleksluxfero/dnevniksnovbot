import { webhookCallback } from "grammy";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { Bot } from "grammy";
import { HfInference } from "@huggingface/inference";
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token)
  throw new Error("TELEGRAM_BOT_TOKEN environment variable not found.");

const bot = new Bot(token);
const hf = new HfInference(process.env.HUGGINGFACE_API_TOKEN || "");

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Привет! Я ваш новый бот на грамми, написанный на TypeScript!",
  );
});

bot.on("message:text", async (ctx) => {
  const chatId = ctx.chat.id;
  // Отправляем сообщение обратно пользователю
  await ctx.reply(`Ваш чат ID: ${chatId}`);
});

// Обработка голосовых сообщений с Whisper
/*bot.on("message:voice", async (ctx) => {
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

    // Отвечаем на конкретное голосовое сообщение
    await ctx.reply(transcription.text, {
      reply_to_message_id: ctx.message.message_id,
    });
  } catch (error) {
    console.error("Ошибка обработки голосового сообщения:", error);
    await ctx.reply("Упс, не смог обработать голосовое сообщение!", {
      reply_to_message_id: ctx.message.message_id,
    });
  }
});*/

// Обработка голосовых сообщений
bot.on("message:voice", async (ctx) => {
  try {
    // Получение файла
    const file = await ctx.getFile();
    if (file.file_size && file.file_size > 5 * 1024 * 1024) {
      await ctx.reply("Голосовое сообщение слишком большое (макс. 5 МБ)", {
        reply_to_message_id: ctx.message.message_id,
      });
      return;
    }

    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const audioBuffer = await response.arrayBuffer();

    // Шаг 1: Расшифровка аудио
    let transcription;
    try {
      transcription = await hf.automaticSpeechRecognition({
        model: "openai/whisper-large-v3",
        data: audioBuffer,
      });
      console.log("Расшифровка:", transcription.text);
    } catch (error) {
      console.error("Ошибка расшифровки аудио:", error);
      await ctx.reply("Не смог распознать голосовое сообщение!", {
        reply_to_message_id: ctx.message.message_id,
      });
      return;
    }

    // Шаг 2: Генерация исправленного текста и тегов с Mixtral-8x7B
    let finalText = transcription.text;

    try {
      const prompt = `
        Сейчас я тебе отправлю текст сновидения, извлеки из него основные теги. Вот пример как это нужно будет сделать: 
        Текст сновидения: Еду с батей на машине по лесу:
        Должны получится такие теги: #батя #машина #лес

        Формат ответа должен быть таким и больше ничего лишнего:
        Исходный текст.
        #тег1 #тег2 #тег3

        Нужно обрабоать этот текст сновидения: ${transcription.text}.
      `;

      console.log(
        "Отправляем запрос к Mixtral-8x7B-Instruct с промптом:",
        prompt,
      );

      async function getChatResponse(prompt: string) {
        let out = "";
        const stream = hf.chatCompletionStream({
          model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
        });
        for await (const chunk of stream) {
          if (chunk.choices && chunk.choices.length > 0) {
            const newContent = chunk.choices[0].delta.content;
            out += newContent;
          }
        }
        return out;
      }

      const response = await getChatResponse(prompt);

      console.log("Ответ от Mixtral-8x7B-Instruct:", response);

      if (response) {
        finalText = response;
      } else {
        console.warn(
          "Ответ от Mixtral-8x7B-Instruct пустой, оставляем расшифровку",
        );
      }
    } catch (error) {
      console.error(
        "Ошибка генерации текста и тегов с Mixtral-8x7B-Instruct:",
        error,
      );
    }

    // Шаг 3: Отправка результата
    await ctx.reply(finalText, {
      reply_to_message_id: ctx.message.message_id,
    });
  } catch (error) {
    console.error("Общая ошибка обработки голосового сообщения:", error);
    await ctx.reply("Упс, что-то пошло не так!", {
      reply_to_message_id: ctx.message.message_id,
    });
  }
});

export const POST = webhookCallback(bot, "std/http");
