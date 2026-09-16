import { NextRequest, NextResponse } from "next/server";
import {
  retrieveRelevantMemories,
  addRecentMessage,
  getRecentMessages,
  extractFacts,
  saveFacts,
} from "../../../lib/memory";

const GEMINI_MODEL = "gemini-2.0-flash";
const API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = "meta-llama/llama-3.2-3b-instruct:free";

// Fungsi panggil Gemini (dipisah biar rapi & bisa di-try-catch)
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

  // INI KUNCINYA: kalau Gemini gagal/limit, res.ok akan false -> lempar error
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

// Fungsi panggil OpenRouter (fallback kalau Gemini gagal)
async function panggilOpenRouter(prompt: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter gagal dengan status ${res.status}`);
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error("OpenRouter tidak mengembalikan jawaban");
  }

  return reply;
}

// Fungsi utama: coba Gemini dulu, kalau gagal baru OpenRouter
async function jawabDenganFallback(prompt: string): Promise<string> {
  try {
    return await panggilGemini(prompt);
  } catch (err) {
    console.log("Gemini gagal, pindah ke OpenRouter:", (err as Error).message);
    try {
      return await panggilOpenRouter(prompt);
    } catch (err2) {
      console.log("OpenRouter juga gagal:", (err2 as Error).message);
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

    const relevantFacts = await retrieveRelevantMemories(userId, message, API_KEY, 5);
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

    // GANTI bagian fetch Gemini langsung dengan fungsi fallback ini:
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
