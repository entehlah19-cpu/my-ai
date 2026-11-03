import { NextRequest, NextResponse } from "next/server";

// Penjaga untuk /api/chat.
// 1) Batas kecepatan: maksimal 40 permintaan per IP per 10 menit.
// 2) Jatah gratis: tiap IP boleh 20 pesan per hari. Setelah itu wajib PIN (ACCESS_PIN di Vercel).
//    Kalau ACCESS_PIN belum diisi, jatah gratis tidak diberlakukan (supaya tidak ada yang terkunci).
// Catatan jujur: hitungan disimpan di memori server, jadi bisa ter-reset kalau server Vercel restart,
// dan yang dihitung jumlah pesan per IP, bukan sisa kuota asli dari Ollama, Serper, atau Cloudflare.

const JENDELA_MS = 10 * 60 * 1000; // 10 menit
const HARI_MS = 24 * 60 * 60 * 1000; // 1 hari
const BATAS_PERMINTAAN = 40;
const BATAS_PIN_SALAH = 8;
const JATAH_GRATIS = 20;

type Hitung = { n: number; mulai: number };
const hitungan = new Map<string, Hitung>();
const pinSalah = new Map<string, Hitung>();
const jatahChat = new Map<string, Hitung>();
const jatahIngat = new Map<string, Hitung>();

function bersihkan(peta: Map<string, Hitung>, jendela: number) {
  if (peta.size <= 5000) return;
  const kini = Date.now();
  for (const [k, v] of peta) {
    if (kini - v.mulai > jendela) peta.delete(k);
  }
}

// Membaca hitungan sekarang tanpa menambah
function baca(peta: Map<string, Hitung>, kunci: string, jendela: number): number {
  const data = peta.get(kunci);
  if (!data || Date.now() - data.mulai > jendela) return 0;
  return data.n;
}

// Menambah hitungan satu
function tambah(peta: Map<string, Hitung>, kunci: string, jendela: number): number {
  bersihkan(peta, jendela);
  const kini = Date.now();
  const data = peta.get(kunci);
  if (!data || kini - data.mulai > jendela) {
    peta.set(kunci, { n: 1, mulai: kini });
    return 1;
  }
  data.n += 1;
  return data.n;
}

function ambilIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "tidak-diketahui";
}

function galat(pesan: string, status: number, perluPin = false): NextResponse {
  return NextResponse.json({ error: pesan, reply: pesan, perluPin }, { status });
}

export async function middleware(req: NextRequest) {
  if (req.method !== "POST") return NextResponse.next();

  const ip = ambilIp(req);
  const pinBenar = process.env.ACCESS_PIN;

  // Baca jenis permintaan dari isi pesan (cek, ingat, gambar, foto, atau chat biasa)
  let aksi = "";
  try {
    const mentah = await req.clone().text();
    const obj = JSON.parse(mentah);
    aksi = typeof obj?.aksi === "string" ? obj.aksi : "";
  } catch {}

  const pinKiriman = (req.headers.get("x-pin") || "").trim();
  const pinSah = !!pinBenar && pinKiriman === pinBenar;

  // Pengecekan PIN dari layar PIN: PIN yang diketik tapi salah selalu ditolak
  if (pinBenar && aksi === "cek" && pinKiriman && !pinSah) {
    if (tambah(pinSalah, ip, JENDELA_MS) > BATAS_PIN_SALAH) {
      return galat("Terlalu banyak PIN salah. Coba lagi sekitar 10 menit.", 429, true);
    }
    return galat("PIN salah. Coba lagi ya.", 401, true);
  }

  // Pengecekan status (tidak mengurangi jatah): kunci hanya kalau jatah gratis sudah habis
  if (aksi === "cek") {
    if (pinBenar && !pinSah && baca(jatahChat, ip, HARI_MS) >= JATAH_GRATIS) {
      return galat("Jatah gratis hari ini sudah habis. Masukkan PIN untuk lanjut.", 401, true);
    }
    return NextResponse.next();
  }

  if (tambah(hitungan, ip, JENDELA_MS) > BATAS_PERMINTAAN) {
    return galat("Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi.", 429);
  }

  // Jatah gratis: yang punya PIN yang benar tidak dibatasi harian
  if (pinBenar && !pinSah) {
    const peta = aksi === "ingat" ? jatahIngat : jatahChat;
    if (baca(peta, ip, HARI_MS) >= JATAH_GRATIS) {
      return galat("Jatah gratis hari ini sudah habis. Masukkan PIN untuk lanjut.", 401, true);
    }
    tambah(peta, ip, HARI_MS);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/chat",
};
