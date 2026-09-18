import { NextRequest, NextResponse } from "next/server";
import { retrieveRelevantMemories, extractFacts, saveFacts } from "../../../lib/memory";

const GEMINI_MODEL = "gemini-3.6-flash";
const API_KEY = process.env.GEMINI_API_KEY;
const LLAMA_API_KEY = process.env.LLAMA_API_KEY;
const OLLAMA_MODEL = "gpt-oss:120b";

type ImagePart = { mimeType: string; data: string };
type HistoryItem = { role: string; content: string };

async function panggilGemini(prompt: string, image?: ImagePart): Promise<string> {
  const parts: any[] = [{ text: prompt }];
  if (image) {
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }] }),
    }
  );

  if (!res.ok) throw new Error(`Gemini gagal dengan status ${res.status}`);
  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!reply) throw new Error("Gemini tidak mengembalikan jawaban");
  return reply;
}

async function panggilOllama(prompt: string): Promise<string> {
  const res = await fetch("https://ollama.com/api/chat", {
    method: "POST",
    headers: { "Authorization": `Bearer ${LLAMA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, messages: [{ role: "user", content: prompt }], stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama gagal dengan status ${res.status}`);
  const data = await res.json();
  const reply = data?.message?.content?.trim();
  if (!reply) throw new Error("Ollama tidak mengembalikan jawaban");
  return reply;
}

async function jawabDenganFallback(prompt: string, image?: ImagePart): Promise<string> {
  try {
    return await panggilGemini(prompt, image);
  } catch (err) {
    console.log("Gemini gagal, pindah ke Ollama:", (err as Error).message);
    try {
      const promptFallback = image
        ? `${prompt}\n\n(Catatan: ada gambar terlampir, tapi model cadangan ini tidak bisa membaca gambar.)`
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
    const { userId, message, image, history } = await req.json();
    // history: array riwayat percakapan dikirim langsung dari browser
    // format: [{ role: "user"|"assistant", content: string }, ...]

    if (!userId || (!message && !image)) {
      return NextResponse.json({ error: "userId dan message/gambar wajib diisi" }, { status: 400 });
    }

    if (image?.data) {
      const approxBytes = (image.data.length * 3) / 4;
      const maxBytes = 4 * 1024 * 1024;
      if (approxBytes > maxBytes) {
        return NextResponse.json({ error: "Ukuran gambar maksimal 4MB" }, { status: 400 });
      }
    }

    let relevantFacts: string[] = [];
    try {
      relevantFacts = await retrieveRelevantMemories(userId, message || "gambar", API_KEY, 5);
    } catch (err) {
      console.log("Gagal ambil memori jangka panjang:", (err as Error).message);
    }

    const memoryBlock = relevantFacts.length
      ? relevantFacts.map((f) => `- ${f}`).join("\n")
      : "(belum ada memori relevan)";

    // Riwayat percakapan sekarang diambil dari yang dikirim client (localStorage),
    // BUKAN dari file server yang gampang ke-reset di Vercel.
    const recentHistory: HistoryItem[] = Array.isArray(history) ? history.slice(-10) : [];
    const historyBlock = recentHistory.length
      ? recentHistory.map((m) => `${m.role}: ${m.content}`).join("\n")
      : "(belum ada riwayat percakapan)";

    const pesanUser = message || "(user mengirim gambar tanpa teks)";

    const prompt = `Kamu adalah AI asisten pribadi dengan memori jangka panjang.

Fakta relevan yang kamu ingat tentang user:
${memoryBlock}

Percakapan terakhir (PENTING: gunakan ini untuk memahami konteks, misal kalau user bilang "boleh" atau "iya", cek apa yang sedang dibahas di sini):
${historyBlock}

Pesan baru dari user: "${pesanUser}"

Jawab secara natural, ringkas, dan langsung ke inti, sesuai konteks percakapan di atas.`;

    const reply = await jawabDenganFallback(prompt, image);

    // Ekstrak fakta jangka panjang tetap jalan di background
    extractFacts(pesanUser, reply, API_KEY)
      .then((facts) => {
        if (facts.length > 0) return saveFacts(userId, facts, API_KEY);
      })
      .catch((e) => console.error("Gagal ekstrak/simpan fakta:", e));

    return NextResponse.json({ reply, memoriesUsed: relevantFacts });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Terjadi kesalahan di server" }, { status: 500 });
  }
}
