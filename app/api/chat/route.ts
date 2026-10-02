import { NextRequest, NextResponse } from "next/server";
import { retrieveRelevantMemories, extractFacts, saveFacts } from "../../../lib/memory";

const GEMINI_MODEL = "gemini-3.6-flash";
const API_KEY = process.env.GEMINI_API_KEY;
const LLAMA_API_KEY = process.env.LLAMA_API_KEY;
const OLLAMA_MODEL = "gpt-oss:120b";
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const SERPER_API_KEY = process.env.SERPER_API_KEY;

const IDENTITAS = `Kamu adalah "My AI", asisten AI pribadi. Jika ditanya siapa kamu atau model apa yang sedang diajak bicara, selalu jawab bahwa kamu adalah "My AI". Jangan menyebut nama model asli di baliknya (seperti Gemini, Llama, GPT, dll), sebutkan hanya "My AI".`;

type ImagePart = { mimeType: string; data: string };
type DocumentPart = { name: string; mimeType: string; data: string };
type HistoryItem = { role: string; content: string };

async function cariWeb(query: string): Promise<string> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": SERPER_API_KEY || "", "Content-Type": "application/json" },
      body: JSON.stringify({ q: query }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return (data.organic || [])
      .slice(0, 5)
      .map((r: any, i: number) => `${i + 1}. ${r.title}\n${r.snippet}\nSumber: ${r.link}`)
      .join("\n\n");
  } catch (err) {
    console.log("Gagal melakukan pencarian web:", (err as Error).message);
    return "";
  }
}

// Ekstrak teks dari PDF atau Word, dipanggil kalau user upload dokumen
async function ekstrakDokumen(doc: DocumentPart): Promise<string> {
  const buffer = Buffer.from(doc.data, "base64");

  try {
    if (doc.mimeType === "application/pdf") {
      // @ts-ignore - pdf-parse tidak menyediakan tipe TypeScript resmi
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(buffer);
      return result.text;
    }

    if (doc.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    return "";
  } catch (err) {
    console.log("Gagal mengekstrak dokumen:", (err as Error).message);
    return "";
  }
}

async function panggilGemini(prompt: string, image?: ImagePart): Promise<string> {
  const parts: any[] = [{ text: `${IDENTITAS}\n\n${prompt}` }];
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
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: IDENTITAS },
        { role: "user", content: prompt },
      ],
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Ollama gagal dengan status ${res.status}`);
  const data = await res.json();
  const reply = data?.message?.content?.trim();
  if (!reply) throw new Error("Ollama tidak mengembalikan jawaban");
  return reply;
}

async function panggilCloudflare(prompt: string): Promise<string> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${CLOUDFLARE_MODEL}`,
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: IDENTITAS },
          { role: "user", content: prompt },
        ],
      }),
    }
  );
  if (!res.ok) throw new Error(`Cloudflare gagal dengan status ${res.status}`);
  const data = await res.json();
  const reply = data?.result?.response?.trim();
  if (!reply) throw new Error("Cloudflare tidak mengembalikan jawaban");
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
      console.log("Ollama gagal, pindah ke Cloudflare:", (err2 as Error).message);
      try {
        return await panggilCloudflare(prompt);
      } catch (err3) {
        console.log("Cloudflare juga gagal:", (err3 as Error).message);
        return "Maaf, AI sedang sibuk banget. Coba lagi sebentar ya 🙏";
      }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, message, image, document, history, webSearch } = await req.json();

    if (!userId || (!message && !image && !document)) {
      return NextResponse.json({ error: "userId dan message/gambar/file wajib diisi" }, { status: 400 });
    }

    if (image?.data) {
      const approxBytes = (image.data.length * 3) / 4;
      if (approxBytes > 4 * 1024 * 1024) {
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

    const recentHistory: HistoryItem[] = Array.isArray(history) ? history.slice(-10) : [];
    const historyBlock = recentHistory.length
      ? recentHistory.map((m) => `${m.role}: ${m.content}`).join("\n")
      : "(belum ada riwayat percakapan)";

    const pesanUser = message || (document ? `(user mengirim file "${document.name}")` : "(user mengirim gambar tanpa teks)");

    // Kalau toggle "Pencarian web" aktif
    let searchBlock = "";
    if (webSearch && message) {
      const hasilSearch = await cariWeb(message);
      if (hasilSearch) {
        searchBlock = `\n\nHasil pencarian web terbaru (gunakan ini untuk jawaban yang akurat dan terkini, sebutkan sumbernya kalau relevan):\n${hasilSearch}`;
      }
    }

    // Kalau ada dokumen PDF/Word, ekstrak isinya
    let docBlock = "";
    if (document) {
      const teksDokumen = await ekstrakDokumen(document);
      if (teksDokumen) {
        docBlock = `\n\nIsi file "${document.name}" (gunakan ini untuk menjawab pertanyaan user):\n${teksDokumen.slice(0, 10000)}`;
      } else {
        docBlock = `\n\n(Catatan: file "${document.name}" terlampir, tapi gagal diekstrak isinya. Beri tahu user untuk coba lagi atau gunakan format lain.)`;
      }
    }

    const prompt = `Fakta relevan yang kamu ingat tentang user:
${memoryBlock}

Percakapan terakhir (PENTING: gunakan ini untuk memahami konteks):
${historyBlock}
${searchBlock}
${docBlock}

Pesan baru dari user: "${pesanUser}"

Jawab secara natural, ringkas, dan langsung ke inti, sesuai konteks percakapan di atas.`;

    const reply = await jawabDenganFallback(prompt, image);

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
