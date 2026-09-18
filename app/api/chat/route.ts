import { NextRequest, NextResponse } from "next/server";
import {
  retrieveRelevantMemories,
  addRecentMessage,
  getRecentMessages,
  extractFacts,
  saveFacts,
} from "../../../lib/memory";

const GEMINI_MODEL = "gemini-3.6-flash";
const API_KEY = process.env.GEMINI_API_KEY;
const LLAMA_API_KEY = process.env.LLAMA_API_KEY;
const OLLAMA_MODEL = "gpt-oss:120b";

// Fungsi panggil Gemini
async function panggilGemini(prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini gagal dengan status ${res.status}`);
  }

  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!reply) {
    throw new Error("Gemini tidak mengembalikan jawaban");
  }

  return reply;
}

// Fungsi panggil Ollama Cloud (fallback kalau Gemini gagal)
async function panggilOllama(prompt: string): Promise<string> {
  const res = await fetch("https://ollama.com/api/chat", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LLAMA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama gagal dengan status ${res.status}`);
  }

  const data = await res.json();
  const reply = data?.message?.content?.trim();

  if (!reply) {
    throw new Error("Ollama tidak mengembalikan jawaban");
  }

  return reply;
}

// Fungsi utama: coba Gemini dulu, kalau gagal baru Ollama
async function jawabDenganFallback(prompt: string): Promise<string> {
  try {
    return await panggilGemini(prompt);
  } catch (err) {
    console.log("Gemini gagal, pindah ke Ollama:", (err as Error).message);
    try {
      return await panggilOllama(prompt);
    } catch (err2) {
      console.log("Ollama juga gagal:", (err2 as Error).message);
      return "Maaf, AI sedang sibuk banget. Coba lagi sebentar ya 🙏";
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, message } = await req.json();

    if (!userId || !message) {
      return NextResponse.json(
        { error: "userId dan message wajib diisi" },
        { status: 400 }
      );
    }

    let relevantFacts: string[] = [];
    try {
      relevantFacts = await retrieveRelevantMemories(userId, message, API_KEY, 5);
    } catch (err) {
      console.log("Gagal ambil memori, lanjut tanpa memori:", (err as Error).message);
    }

    const recentMessages = getRecentMessages(userId);

    const memoryBlock = relevantFacts.length
      ? relevantFacts.map((f) => `- ${f}`).join("\n")
      : "(belum ada memori relevan)";

    const historyBlock = recentMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const prompt = `Kamu adalah AI asisten pribadi dengan memori jangka panjang.

Fakta relevan yang kamu ingat tentang user (pakai kalau nyambung ke pertanyaan):
${memoryBlock}

Percakapan terakhir:
${historyBlock}

Pesan baru dari user: "${message}"

Jawab secara natural, ringkas, dan langsung ke inti. Kalau ada fakta di atas yang relevan sama pertanyaan user, pakai itu buat personalisasi jawaban (tanpa harus menyebut kata "memori" secara eksplisit).`;

    const reply = await jawabDenganFallback(prompt);

    addRecentMessage(userId, "user", message);
    addRecentMessage(userId, "assistant", reply);

    extractFacts(message, reply, API_KEY)
      .then((facts) => {
        if (facts.length > 0) return saveFacts(userId, facts, API_KEY);
      })
      .catch((e) => console.error("Gagal ekstrak/simpan fakta:", e));

    return NextResponse.json({ reply, memoriesUsed: relevantFacts });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Terjadi kesalahan di server" },
      { status: 500 }
    );
  }
}
