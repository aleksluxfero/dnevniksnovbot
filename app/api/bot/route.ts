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

    // Шаг 2: Генерация исправленного текста и тегов с zephyr-7b-beta
    let finalText = transcription.text;
    try {
      const prompt = `
        На основе следующего текста извлеки основные специфичные теги, исключая общие понятия вроде "сон", 
        а также исправь потенциально неправильную расшифровку аудиосообщения, например, если в сообщении 
        написано слово "пухаеш", а на самом деле должно быть "бухаешь" При том не забывай что это всего лишь сон и не нужно критически относится к тексту, так как во сне может быть все что угодно. 
        
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

      console.log("Отправляем запрос к zephyr-7b-beta с промптом:", prompt);

      const response = await hf.textGeneration({
        model: "HuggingFaceH4/zephyr-7b-beta",
        inputs: prompt,
        parameters: {
          max_new_tokens: 100,
          temperature: 0.7,
        },
      });

      console.log("Ответ от zephyr-7b-beta:", response);

      if (response && response.generated_text) {
        finalText = response.generated_text;
      } else {
        console.warn("Ответ от zephyr-7b-beta пустой, оставляем расшифровку");
      }
    } catch (error) {
      console.error("Ошибка генерации текста и тегов с zephyr-7b-beta:", error);
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
