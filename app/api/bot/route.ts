import { Bot } from "grammy";
import { HfInference } from "@huggingface/inference";
import { NextRequest, NextResponse } from "next/server";

// Инициализация бота и Hugging Face
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || "");
const hf = new HfInference(process.env.HUGGINGFACE_API_TOKEN || "");

// Обработка POST-запросов от Telegram
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await bot.handleUpdate(body);
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("Error handling update:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// Обработка голосовых сообщений
bot.on("message:voice", async (ctx) => {
  try {
    const file = await ctx.getFile();
    if (file.file_size && file.file_size > 5 * 1024 * 1024) {
      return ctx.reply("Voice message too large (max 5MB)");
    }

    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const audioBuffer = await response.arrayBuffer();

    const transcription = await hf.automaticSpeechRecognition({
      model: "openai/whisper-large-v3",
      data: audioBuffer,
    });

    await ctx.reply(`Transcription: ${transcription.text}`);
  } catch (error) {
    console.error("Error processing voice:", error);
    await ctx.reply("Sorry, I couldn't process your voice message.");
  }
});

// Команда /start
bot.command("start", (ctx) => ctx.reply("Send me a voice message and I'll transcribe it!"));