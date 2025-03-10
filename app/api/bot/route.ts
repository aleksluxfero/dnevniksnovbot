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
    const transcription = await hf.automaticSpeechRecognition({
      model: "openai/whisper-large-v3",
      data: audioBuffer,
    });

    // Шаг 2: Генерация исправленного текста и тегов через DeepSeek-R1
    const prompt = `
      На основе следующего текста извлеки основные специфичные теги, исключая общие понятия вроде "сон", 
      а также исправь потенциально неправильную расшифровку аудиосообщения, например, если в сообщении 
      написано слово "пухаеш", а на самом деле должно быть "бухаешь". 
      
      Пример:
      Текст: "Приснилось, что я пегаю по болю с единорогом"
      Ответ:
      Приснилось, что я бегаю по полю с единорогом.
      #бег #поле #единорог
      
      Теперь обработай этот текст:
      Текст: "${transcription.text}"
      
      Формат ответа должен быть строго таким, больше ничего лишнего:
      [исправленный текст сообщения].
      #тег1 #тег2 #тег3
    `;

    const deepSeekResponse = await hf.textGeneration({
      model: "deepseek-ai/DeepSeek-R1",
      inputs: prompt,
      parameters: {
        max_new_tokens: 100,
        temperature: 0.7,
      },
    });

    // Шаг 3: Отправка ответа напрямую
    await ctx.reply(deepSeekResponse.generated_text, {
      reply_to_message_id: ctx.message.message_id,
    });
  } catch (error) {
    console.error("Ошибка обработки голосового сообщения:", error);
    await ctx.reply("Упс, не смог обработать голосовое сообщение!", {
      reply_to_message_id: ctx.message.message_id,
    });
  }
});

export const POST = webhookCallback(bot, "std/http");
