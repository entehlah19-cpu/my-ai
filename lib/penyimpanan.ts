// Penyimpanan obrolan di IndexedDB (jauh lebih lega daripada localStorage yang hanya sekitar 5MB)
// dan pencarian ingatan: mencari potongan obrolan lama yang nyambung dengan pesan baru.
// Semua data tetap di browser kamu. Obrolan incognito tidak pernah disimpan atau dicari.

const NAMA_DB = "myai-db";
const VERSI_DB = 1;
const TOKO = "obrolan";
const KUNCI_LAMA = "myai-conversations";

type Pesan = { role: string; content: string };
type ObrolanMin = { id: string; title: string; incognito?: boolean; messages: Pesan[] };

function bukaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB tidak tersedia"));
      return;
    }
    const req = indexedDB.open(NAMA_DB, VERSI_DB);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TOKO)) db.createObjectStore(TOKO, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tungguTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function mintaHasil<R>(req: IDBRequest<R>): Promise<R> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Isi terakhir yang sudah tersimpan per obrolan, supaya hanya yang berubah yang ditulis ulang
const sudahTersimpan = new Map<string, string>();

// Memuat semua obrolan. Kalau IndexedDB masih kosong, ambil dari localStorage lama (migrasi sekali jalan).
export async function muatSemua<T extends { id: string }>(): Promise<{ daftar: T[]; dariLama: boolean }> {
  try {
    const db = await bukaDb();
    const tx = db.transaction(TOKO, "readonly");
    const semua = (await mintaHasil(tx.objectStore(TOKO).getAll())) as any[];
    db.close();
    if (semua.length > 0) {
      semua.sort((a, b) => (a._urutan ?? 0) - (b._urutan ?? 0));
      const daftar = semua.map((o) => {
        const { _urutan, ...isi } = o;
        return isi as T;
      });
      daftar.forEach((c, i) => sudahTersimpan.set(c.id, JSON.stringify({ ...c, _urutan: i })));
      return { daftar, dariLama: false };
    }
  } catch {
    // IndexedDB gagal dibuka: lanjut coba localStorage lama
  }
  try {
    const mentah = localStorage.getItem(KUNCI_LAMA);
    if (mentah) {
      const parsed = JSON.parse(mentah);
      if (Array.isArray(parsed) && parsed.length > 0) return { daftar: parsed as T[], dariLama: true };
    }
  } catch {}
  return { daftar: [], dariLama: false };
}

// Menyimpan semua obrolan (kecuali incognito, yang harus sudah disaring oleh pemanggil).
// Hanya obrolan yang berubah yang ditulis, dan obrolan yang sudah dihapus ikut dibuang.
export async function simpanSemua<T extends { id: string }>(daftar: T[]): Promise<boolean> {
  try {
    const db = await bukaDb();
    const tx = db.transaction(TOKO, "readwrite");
    const toko = tx.objectStore(TOKO);
    const idAda = new Set(daftar.map((c) => c.id));
    const kunciLama = (await mintaHasil(toko.getAllKeys())) as IDBValidKey[];
    for (const k of kunciLama) {
      if (!idAda.has(String(k))) {
        toko.delete(k);
        sudahTersimpan.delete(String(k));
      }
    }
    daftar.forEach((c, i) => {
      const isi = JSON.stringify({ ...c, _urutan: i });
      if (sudahTersimpan.get(c.id) !== isi) {
        toko.put({ ...c, _urutan: i });
        sudahTersimpan.set(c.id, isi);
      }
    });
    await tungguTx(tx);
    db.close();
    return true;
  } catch {
    return false;
  }
}

// Membuang salinan lama di localStorage setelah data berhasil pindah ke IndexedDB
export function bersihkanLama(): void {
  try {
    localStorage.removeItem(KUNCI_LAMA);
  } catch {}
}

// Menghapus semua obrolan di IndexedDB
export async function hapusSemuaData(): Promise<void> {
  try {
    const db = await bukaDb();
    const tx = db.transaction(TOKO, "readwrite");
    tx.objectStore(TOKO).clear();
    await tungguTx(tx);
    db.close();
    sudahTersimpan.clear();
  } catch {}
}

// Meminta browser supaya tidak menghapus data situs ini saat ruang penyimpanan menipis
export async function mintaPermanen(): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.persist === "function") {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {}
  return false;
}

// ---- Pencarian ingatan ----
const KATA_UMUM = new Set(
  (
    "yang dan di ke dari ini itu aku kamu gue lu lo loe elu kau saya anda dia kita kami mereka apa siapa kapan dimana mana " +
    "kenapa mengapa bagaimana gimana bisa tidak nggak gak ngga enggak ya iya yg dg dgn untuk buat bikin sama atau juga " +
    "jadi udah sudah belum lagi masih mau akan ada adalah dengan pada dalam karena kalau kalo tapi tetapi terus lalu " +
    "the and for you are with this that from what how"
  ).split(" ")
);

function pecahKata(teks: string): string[] {
  return teks
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u024f]+/)
    .filter((k) => k.length >= 3 && !KATA_UMUM.has(k));
}

// Mencari potongan obrolan lama (obrolan lain, bukan incognito) yang paling nyambung dengan pesan baru.
// Hasilnya berupa daftar kalimat singkat siap kirim ke server (field obrolanLain).
export function cariIngatan(daftar: ObrolanMin[], idAktif: string, pesanBaru: string, maks = 5): string[] {
  const kataCari = Array.from(new Set(pecahKata(pesanBaru.slice(0, 400))));
  if (kataCari.length === 0) return [];

  type Calon = { judul: string; peran: string; teks: string; kata: Set<string>; urutan: number };
  const calon: Calon[] = [];
  let urutan = 0;
  for (const c of daftar) {
    if (c.id === idAktif || c.incognito) continue;
    for (const m of c.messages) {
      urutan += 1;
      if (!m || typeof m.content !== "string" || m.content.length < 12) continue;
      const teks = m.content.replace(/\s+/g, " ").trim();
      calon.push({ judul: c.title || "Obrolan", peran: m.role, teks, kata: new Set(pecahKata(teks.slice(0, 3000))), urutan });
    }
  }
  if (calon.length === 0) return [];

  // Kata yang jarang muncul di banyak pesan dianggap lebih penting
  const df = new Map<string, number>();
  for (const k of kataCari) {
    let n = 0;
    for (const x of calon) if (x.kata.has(k)) n += 1;
    df.set(k, n);
  }

  const syaratCocok = kataCari.length >= 3 ? 2 : 1;
  const nilai: { skor: number; x: Calon }[] = [];
  for (const x of calon) {
    let skor = 0;
    let cocok = 0;
    for (const k of kataCari) {
      if (x.kata.has(k)) {
        cocok += 1;
        skor += Math.log(1 + calon.length / (1 + (df.get(k) || 0)));
      }
    }
    if (cocok < syaratCocok) continue;
    skor = skor / Math.sqrt(1 + x.kata.size / 20) + (x.urutan / urutan) * 0.3;
    nilai.push({ skor, x });
  }
  nilai.sort((a, b) => b.skor - a.skor);

  const hasil: string[] = [];
  const dipakai = new Set<string>();
  for (const { x } of nilai) {
    if (hasil.length >= maks) break;
    // Ambil potongan di sekitar kata yang cocok
    const lower = x.teks.toLowerCase();
    let posisi = 0;
    for (const k of kataCari) {
      const i = lower.indexOf(k);
      if (i >= 0) {
        posisi = i;
        break;
      }
    }
    const mulai = Math.max(0, posisi - 60);
    const potong = x.teks.slice(mulai, mulai + 190);
    if (dipakai.has(potong)) continue;
    dipakai.add(potong);
    const judul = x.judul.slice(0, 24);
    hasil.push(`${judul} (${x.peran === "user" ? "kamu" : "My AI"}): ${potong}`.slice(0, 260));
  }
  return hasil;
}
