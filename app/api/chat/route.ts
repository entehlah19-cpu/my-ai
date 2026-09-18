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

type ImagePart = { mimeType: string; data: string }; // data = base64 tanpa prefix

// Fungsi panggil Gemini, sekarang bisa terima gambar juga
async function panggilGemini(prompt: string, image?: ImagePart): Promise<string> {
  const parts: any[] = [{ text: prompt }];
  if (image) {
    parts.push({
      inline_data: { mime_type: image.mimeType, data: image.data },
    });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
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

// Ollama (fallback) - catatan: model teks biasa tidak bisa baca gambar,
// jadi kalau ada gambar dan Gemini gagal, kita kasih tahu keterbatasannya di prompt.
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

async function jawabDenganFallback(prompt: string, image?: ImagePart): Promise<string> {
  try {
    return await panggilGemini(prompt, image);
  } catch (err) {
    console.log("Gemini gagal, pindah ke Ollama:", (err as Error).message);
    try {
      const promptFallback = image
        ? `${prompt}\n\n(Catatan: ada gambar terlampir, tapi model cadangan ini tidak bisa membaca gambar. Jawab semampunya berdasarkan teks saja.)`
        : prompt;
      return await panggilOllama(promptFallback);
    } catch (err2) {
      console.log("Ollama juga gagal:", (err2 as Error).message);
      return "Maaf, AI sedang sibuk banget. Coba lagi sebentar ya 🙏";
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, message, image } = await req.json();
    // image (opsional) format: { mimeType: string, data: string (base64) }

    if (!userId || (!message && !image)) {
      return NextResponse.json(
        { error: "userId dan message/gambar wajib diisi" },
        { status: 400 }
      );
    }

    // Validasi ukuran gambar (base64 sekitar 1.37x ukuran asli)
    if (image?.data) {
      const approxBytes = (image.data.length * 3) / 4;
      const maxBytes = 4 * 1024 * 1024; // 4MB, batas aman Vercel
      if (approxBytes > maxBytes) {
        return NextResponse.json(
          { error: "Ukuran gambar maksimal 4MB" },
          { status: 400 }
        );
      }
    }

    let relevantFacts: string[] = [];
    try {
      relevantFacts = await retrieveRelevantMemories(userId, message || "gambar", API_KEY, 5);
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

    const pesanUser = message || "(user mengirim gambar tanpa teks)";

    const prompt = `Kamu adalah AI asisten pribadi dengan memori jangka panjang.

Fakta relevan yang kamu ingat tentang user (pakai kalau nyambung ke pertanyaan):
${memoryBlock}

Percakapan terakhir:
${historyBlock}

Pesan baru dari user: "${pesanUser}"

Jawab secara natural, ringkas, dan langsung ke inti. Kalau ada fakta di atas yang relevan sama pertanyaan user, pakai itu buat personalisasi jawaban (tanpa harus menyebut kata "memori" secara eksplisit).`;

    const reply = await jawabDenganFallback(prompt, image);

    addRecentMessage(userId, "user", pesanUser);
    addRecentMessage(userId, "assistant", reply);

    extractFacts(pesanUser, reply, API_KEY)
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
