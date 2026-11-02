import { NextRequest, NextResponse } from "next/server";

// Penjaga untuk /api/chat: PIN akses (opsional) dan batas pemakaian per IP.
// PIN hanya aktif kalau variabel ACCESS_PIN diisi di Vercel. Kalau kosong, hanya batas pemakaian yang jalan.
// Catatan jujur: hitungan disimpan di memori server, jadi bisa ter-reset kalau server Vercel restart.
// Ini pengaman dasar tanpa database, bukan benteng anti-bocor total.

const JENDELA_MS = 10 * 60 * 1000; // 10 menit
const BATAS_PERMINTAAN = 40; // maksimal permintaan per IP per 10 menit
const BATAS_PIN_SALAH = 8; // maksimal salah PIN per IP per 10 menit

type Hitung = { n: number; mulai: number };
const hitungan = new Map<string, Hitung>();
const pinSalah = new Map<string, Hitung>();

// Menambah hitungan; mengembalikan true kalau sudah melewati batas
function lewatBatas(peta: Map<string, Hitung>, kunci: string, batas: number): boolean {
  const kini = Date.now();
  if (peta.size > 5000) {
    for (const [k, v] of peta) {
      if (kini - v.mulai > JENDELA_MS) peta.delete(k);
    }
  }
  const data = peta.get(kunci);
  if (!data || kini - data.mulai > JENDELA_MS) {
    peta.set(kunci, { n: 1, mulai: kini });
    return false;
  }
  data.n += 1;
  return data.n > batas;
}

function ambilIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "tidak-diketahui";
}

function galat(pesan: string, status: number, perluPin = false): NextResponse {
  return NextResponse.json({ error: pesan, reply: pesan, perluPin }, { status });
}

export function middleware(req: NextRequest) {
  if (req.method !== "POST") return NextResponse.next();

  const ip = ambilIp(req);
  const pinBenar = process.env.ACCESS_PIN;

  if (pinBenar) {
    const pinKiriman = (req.headers.get("x-pin") || "").trim();
    if (pinKiriman !== pinBenar) {
      // PIN kosong (baru buka halaman) tidak dihitung sebagai salah
      if (pinKiriman && lewatBatas(pinSalah, ip, BATAS_PIN_SALAH)) {
        return galat("Terlalu banyak PIN salah. Coba lagi sekitar 10 menit.", 429, true);
      }
      return galat("PIN salah atau belum diisi.", 401, true);
    }
  }

  if (lewatBatas(hitungan, ip, BATAS_PERMINTAAN)) {
    return galat("Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi.", 429);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/chat",
};
