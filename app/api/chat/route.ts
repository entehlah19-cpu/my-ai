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
    const data = await res.json();
    const reply: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Maaf, aku belum bisa jawab itu.";

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
