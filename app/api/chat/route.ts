// lib/memory.js
//
// Long-term memory versi "canggih":
// - Fakta diekstrak otomatis dari tiap percakapan (bukan simpan mentah)
// - Tiap fakta punya embedding vector (buat semantic search)
// - Saat chat baru, sistem cari fakta paling RELEVAN (bukan cuma yang terbaru)
// - Skor akhir = kemiripan makna + kepentingan + kebaruan
//
// Storage masih file JSON (gampang buat dev/local). Untuk production,
// ganti loadStore()/saveStore() ke database (Supabase/Upstash/Postgres+pgvector).

import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "memories.json");
const EMBED_MODEL = "text-embedding-004";
const CHAT_MODEL = "gemini-2.0-flash";

// ---------- Storage dasar ----------

function ensureStoreExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({}));
}

function loadStore() {
  ensureStoreExists();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8") || "{}");
}

function saveStore(store) {
  ensureStoreExists();
  fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
}

function getUserData(userId) {
  const store = loadStore();
  if (!store[userId]) {
    store[userId] = { facts: [], recentMessages: [] };
    saveStore(store);
  }
  return store[userId];
}

// ---------- Embedding & similarity ----------

async function getEmbedding(text, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
      }),
    }
  );
  const data = await res.json();
  return data?.embedding?.values || [];
}

function cosineSimilarity(a, b) {
  if (!a.length || !b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

// ---------- Ekstraksi fakta otomatis ----------

// Minta Gemini nentuin fakta apa aja yang layak diinget dari 1 pertukaran chat.
// Return array: [{ text, category, importance (1-10) }]
export async function extractFacts(userMessage, aiReply, apiKey) {
  const prompt = `Dari percakapan berikut, ekstrak fakta-fakta PENTING tentang user yang layak diingat jangka panjang
(contoh: nama, preferensi, pekerjaan, proyek yang dikerjakan, kebiasaan, hal yang disukai/tidak disukai).
Abaikan basa-basi atau small talk yang tidak penting.

User: "${userMessage}"
AI: "${aiReply}"

Jawab HANYA dalam format JSON array, tanpa markdown, tanpa penjelasan tambahan. Contoh format:
[{"text": "User bernama Budi", "category": "identitas", "importance": 9}]

Kalau tidak ada fakta penting, jawab: []`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    }
  );
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  const cleaned = raw.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

// Simpan fakta baru ke memori user (dengan embedding-nya)
export async function saveFacts(userId, facts, apiKey) {
  const store = loadStore();
  const user = store[userId] || { facts: [], recentMessages: [] };

  for (const fact of facts) {
    const embedding = await getEmbedding(fact.text, apiKey);
    user.facts.push({
      id: Date.now() + Math.random(),
      text: fact.text,
      category: fact.category || "umum",
      importance: fact.importance || 5,
      embedding,
      createdAt: Date.now(),
    });
  }

  store[userId] = user;
  saveStore(store);
}

// ---------- Retrieval: cari fakta paling relevan ----------

export async function retrieveRelevantMemories(userId, query, apiKey, topK = 5) {
  const user = getUserData(userId);
  if (user.facts.length === 0) return [];

  const queryEmbedding = await getEmbedding(query, apiKey);
  const now = Date.now();

  const scored = user.facts.map((fact) => {
    const similarity = cosineSimilarity(queryEmbedding, fact.embedding);
    const ageInDays = (now - fact.createdAt) / (1000 * 60 * 60 * 24);
    const recencyScore = 1 / (1 + ageInDays / 30); // makin lama, makin turun (soft decay)
    const importanceScore = fact.importance / 10;

    // Skor gabungan: kemiripan makna paling dominan, dibantu kepentingan & kebaruan
    const finalScore = similarity * 0.6 + importanceScore * 0.3 + recencyScore * 0.1;

    return { ...fact, score: finalScore };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((f) => f.text);
}

// ---------- Histori mentah jangka pendek (buat konteks langsung) ----------

export function addRecentMessage(userId, role, content, keep = 6) {
  const store = loadStore();
  const user = store[userId] || { facts: [], recentMessages: [] };
  user.recentMessages.push({ role, content });
  user.recentMessages = user.recentMessages.slice(-keep);
  store[userId] = user;
  saveStore(store);
}

export function getRecentMessages(userId) {
  return getUserData(userId).recentMessages;
}
