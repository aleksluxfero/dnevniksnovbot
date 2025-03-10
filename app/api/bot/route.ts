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
  await ctx.reply(`Ваш чат ID: ${chatId}`);
});

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

    // Шаг 2: Получение только тегов с Mixtral-8x7B
    let tags = "";
    try {
      const prompt = `
        Извлеки из текста основные теги. Верни ТОЛЬКО теги через пробел, каждый с #.
        Пример:
        Входной текст: "Еду с батей на машине по лесу"
        Выход: "#батя #машина #лес"
        
        Обработай этот текст: "${transcription.text}"
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
      console.log("Ответ от Mixtral-8x7B-Instruct (теги):", response);
      tags = response.trim();
    } catch (error) {
      console.error("Ошибка генерации тегов:", error);
      tags = "#ошибка";
    }

    // Шаг 3: Форматирование результата
    const formattedResponse = `${transcription.text}.\n${tags}`;

    // Шаг 4: Отправка результата
    await ctx.reply(formattedResponse, {
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